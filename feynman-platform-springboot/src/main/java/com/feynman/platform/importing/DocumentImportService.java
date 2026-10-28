package com.feynman.platform.importing;

import com.feynman.platform.common.ApiException;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.zip.*;
import javax.imageio.*;
import javax.imageio.stream.ImageInputStream;
import javax.xml.stream.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentImportService {
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    public static final int MAX_CHARS = 100_000;
    private final BaiduOcrClient ocr;
    private final Semaphore parsing = new Semaphore(1);
    public DocumentImportService(BaiduOcrClient ocr) { this.ocr = ocr; }

    public DocumentImportResponse parse(MultipartFile file, boolean allowOcr) {
        return parse(file, allowOcr, false);
    }

    public DocumentImportResponse parse(MultipartFile file, boolean allowOcr, boolean imageOnly) {
        if (file == null || file.isEmpty()) throw bad("EMPTY_FILE", "请选择非空文件");
        if (file.getSize() > MAX_BYTES) throw tooLarge();
        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("导入文件").replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1);
        String extension = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
        if (!Set.of("docx", "pdf", "jpg", "jpeg", "png", "txt", "md").contains(extension)) throw bad("UNSUPPORTED_FILE", "支持DOCX、PDF、JPG、PNG、TXT和Markdown；旧版DOC请先另存为DOCX");
        if (!parsing.tryAcquire()) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "IMPORT_BUSY", "服务器正在解析其他文件，请稍后再试");
        try {
            byte[] bytes;
            try (var input = file.getInputStream()) { bytes = input.readNBytes(MAX_BYTES + 1); }
            if (bytes.length > MAX_BYTES) throw tooLarge();
            String title = filename.contains(".") ? filename.substring(0, filename.lastIndexOf('.')) : filename;
            title = title.isBlank() ? "导入知识点" : title.substring(0, Math.min(255, title.length()));
            String text;
            String image = null;
            boolean usedOcr = false;
            int pages = 1;
            List<String> warnings = new ArrayList<>();
            switch (extension) {
                case "docx" -> { text = docx(bytes); warnings.add("仅提取正文和表格文字，不保留原排版或内嵌图片。"); }
                case "pdf" -> {
                    if (bytes.length < 5 || !new String(bytes, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-")) throw bad("INVALID_PDF", "文件内容不是有效PDF");
                    try (PDDocument document = Loader.loadPDF(bytes)) {
                        if (document.isEncrypted() && !document.getCurrentAccessPermission().canExtractContent()) throw bad("PDF_RESTRICTED", "PDF不允许提取内容，请使用可读取的副本");
                        pages = document.getNumberOfPages();
                        if (pages > 20) throw bad("TOO_MANY_PAGES", "单次最多导入20页PDF，请拆分文件后上传");
                        List<String> pageTexts = new ArrayList<>();
                        List<Integer> scanned = new ArrayList<>();
                        int length = 0;
                        for (int page = 1; page <= pages; page++) {
                            PDFTextStripper stripper = new PDFTextStripper();
                            stripper.setStartPage(page); stripper.setEndPage(page); stripper.setSortByPosition(true);
                            LimitedWriter writer = new LimitedWriter(MAX_CHARS - length);
                            stripper.writeText(document, writer);
                            String value = writer.toString().trim();
                            pageTexts.add(value); length += value.length();
                            if (value.isBlank()) scanned.add(page - 1);
                        }
                        if (!scanned.isEmpty() && !allowOcr && length > 0) {
                            warnings.add("有" + scanned.size() + "页未提取到文字，可能是扫描页或空白页；若需要识别，请允许OCR后重试。");
                        } else if (!scanned.isEmpty()) {
                            requireOcrConsent(allowOcr);
                            if (scanned.size() > 5) throw bad("OCR_PAGE_LIMIT", "一次最多识别5页扫描内容，请拆分PDF后上传");
                            PDFRenderer renderer = new PDFRenderer(document);
                            renderer.setSubsamplingAllowed(true);
                            for (int page : scanned) {
                                var box = document.getPage(page).getCropBox();
                                float edge = Math.max(box.getWidth(), box.getHeight());
                                if (!Float.isFinite(edge) || edge <= 0) throw bad("INVALID_PDF", "PDF页面尺寸异常");
                                BufferedImage rendered = renderer.renderImageWithDPI(page, Math.min(140f, 1600f * 72 / edge));
                                pageTexts.set(page, ocr.recognize(jpeg(rendered))); rendered.flush();
                            }
                            usedOcr = true;
                            warnings.add("扫描页使用OCR识别，请检查错字、表格和公式；空白页可能没有识别结果。");
                        }
                        text = String.join("\n\n", pageTexts);
                    }
                }
                case "jpg", "jpeg", "png" -> {
                    byte[] prepared = prepareImage(bytes);
                    image = "data:image/jpeg;base64," + Base64.getEncoder().encodeToString(prepared);
                    if (imageOnly) {
                        text = "";
                        warnings.add("仅插入配图，不进行OCR。请补充文字说明，当前AI问答只能检索文字内容。");
                    } else {
                        requireOcrConsent(allowOcr);
                        text = ocr.recognize(prepared); usedOcr = true;
                    }
                    warnings.add("图片已压缩用于预览和可选配图；识别结果请人工核对，公式和复杂表格可能不准确。");
                    if (text.isBlank()) warnings.add("没有识别到文字，你可以保留配图并手动补充正文。");
                }
                default -> text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .decode(ByteBuffer.wrap(bytes)).toString().replace("\uFEFF", "");
            }
            text = text.replace("\u0000", "").trim();
            if (text.length() > MAX_CHARS) throw bad("TEXT_TOO_LONG", "解析文字超过10万字符，请拆分为多个文件");
            if (text.isBlank() && image == null) throw bad("NO_TEXT", "未提取到文字，请检查文件内容，或使用清晰图片识别");
            if (text.length() > 10_000) warnings.add("内容较长，建议拆成多个知识点；测评和复述对原文长度有额外限制。");
            return new DocumentImportResponse(title, text, filename, extension, pages, usedOcr, image, List.copyOf(warnings));
        } catch (ApiException e) { throw e; }
        catch (InvalidPasswordException e) { throw bad("PDF_PASSWORD", "PDF有密码保护，请先解除密码后上传"); }
        catch (CharacterCodingException e) { throw bad("TEXT_ENCODING", "文本文件需使用UTF-8编码，请另存为UTF-8后上传"); }
        catch (Exception e) { throw bad("IMPORT_FAILED", "文件无法解析，可能已损坏或格式不受支持，请另存后重试"); }
        finally { parsing.release(); }
    }

    private String docx(byte[] bytes) throws Exception {
        if (bytes.length < 4 || bytes[0] != 'P' || bytes[1] != 'K') throw bad("INVALID_DOCX", "文件内容不是有效DOCX");
        byte[] xml = null;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            ZipEntry entry; int entries = 0; long expanded = 0;
            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > 2000) throw bad("DOCX_LIMIT", "Word内部文件过多，请简化文件后重试");
                if (entry.getName().equals("word/document.xml")) {
                    xml = zip.readNBytes(MAX_BYTES + 1);
                    if (xml.length > MAX_BYTES) throw tooLarge();
                    break;
                }
                byte[] buffer = new byte[8192]; int count;
                while ((count = zip.read(buffer)) != -1) {
                    expanded += count;
                    if (expanded > 30L * 1024 * 1024) throw bad("DOCX_LIMIT", "Word解压内容过大，请简化文件后重试");
                }
            }
        }
        if (xml == null) throw bad("INVALID_DOCX", "没有找到Word正文，请上传标准DOCX文件");
        XMLInputFactory factory = XMLInputFactory.newFactory();
        factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        factory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        XMLStreamReader reader = factory.createXMLStreamReader(new ByteArrayInputStream(xml));
        StringBuilder output = new StringBuilder(); boolean inText = false;
        try {
            while (reader.hasNext()) {
                int event = reader.next();
                if (event == XMLStreamConstants.DTD) throw bad("INVALID_DOCX", "Word内容包含不支持的XML声明");
                if (event == XMLStreamConstants.START_ELEMENT) {
                    String name = reader.getLocalName();
                    if (name.equals("t")) inText = true;
                    else if (name.equals("tab")) output.append('\t');
                    else if (name.equals("br")) output.append('\n');
                } else if (event == XMLStreamConstants.CHARACTERS && inText) output.append(reader.getText());
                else if (event == XMLStreamConstants.END_ELEMENT) {
                    String name = reader.getLocalName();
                    if (name.equals("t")) inText = false;
                    if (name.equals("p") || name.equals("tr")) output.append('\n');
                    if (name.equals("tc")) output.append('\t');
                }
                if (output.length() > MAX_CHARS) throw bad("TEXT_TOO_LONG", "Word文字超过10万字符，请拆分文件");
            }
        } finally { reader.close(); }
        return output.toString();
    }

    private byte[] prepareImage(byte[] bytes) throws Exception {
        boolean png = bytes.length > 8 && bytes[0] == (byte)137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71;
        boolean jpg = bytes.length > 3 && bytes[0] == (byte)255 && bytes[1] == (byte)216 && bytes[2] == (byte)255;
        if (!png && !jpg) throw bad("INVALID_IMAGE", "图片内容不是有效PNG或JPEG");
        try (ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw bad("INVALID_IMAGE", "无法读取图片");
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width < 15 || height < 15 || (long)width * height > 20_000_000) throw bad("IMAGE_DIMENSIONS", "图片需至少15像素，且不超过2000万像素");
                var param = reader.getDefaultReadParam(); int sample = Math.max(1, Math.max(width, height) / 1600);
                param.setSourceSubsampling(sample, sample, 0, 0);
                BufferedImage source = reader.read(0, param);
                try { return jpeg(source); } finally { source.flush(); }
            } finally { reader.dispose(); }
        }
    }

    private byte[] jpeg(BufferedImage source) throws IOException {
        double scale = Math.min(1.0, 1600.0 / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int)(source.getWidth() * scale)), height = Math.max(1, (int)(source.getHeight() * scale));
        BufferedImage rgb = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rgb.createGraphics();
        try { graphics.setColor(Color.WHITE); graphics.fillRect(0,0,width,height); graphics.drawImage(source,0,0,width,height,null); }
        finally { graphics.dispose(); }
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try { ImageIO.write(rgb, "jpeg", output); } finally { rgb.flush(); }
        if (output.size() > 3 * 1024 * 1024) throw bad("IMAGE_TOO_LARGE", "图片压缩后仍过大，请降低分辨率");
        return output.toByteArray();
    }

    private void requireOcrConsent(boolean allowed) {
        if (!allowed) throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "OCR_CONSENT_REQUIRED", "此文件包含图片或扫描页，请勾选允许OCR识别后重新解析；文件内容会发送至百度OCR");
    }
    private ApiException bad(String code, String message) { return new ApiException(HttpStatus.BAD_REQUEST, code, message); }
    private ApiException tooLarge() { return new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "单个文件不能超过10MB"); }

    private static final class LimitedWriter extends Writer {
        private final int limit; private final StringBuilder text = new StringBuilder();
        LimitedWriter(int limit) { this.limit = limit; }
        @Override public void write(char[] chars, int offset, int count) {
            if (text.length() + count > limit) throw new ApiException(HttpStatus.BAD_REQUEST, "TEXT_TOO_LONG", "PDF文字超过10万字符，请拆分文件");
            text.append(chars, offset, count);
        }
        @Override public void flush() {}
        @Override public void close() {}
        @Override public String toString() { return text.toString(); }
    }
}
