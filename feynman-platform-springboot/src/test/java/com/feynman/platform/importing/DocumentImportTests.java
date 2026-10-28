package com.feynman.platform.importing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.common.LearningText;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.MockMultipartFile;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DocumentImportTests {
    BaiduOcrClient ocr;
    DocumentImportService service;
    @BeforeEach void setup() { ocr = mock(BaiduOcrClient.class); service = new DocumentImportService(ocr); }

    MockMultipartFile file(String name, byte[] data) { return new MockMultipartFile("file", name, "application/octet-stream", data); }
    byte[] docx(String xml) throws Exception {
        var output = new ByteArrayOutputStream();
        try (var zip = new ZipOutputStream(output)) { zip.putNextEntry(new ZipEntry("word/document.xml")); zip.write(xml.getBytes(StandardCharsets.UTF_8)); zip.closeEntry(); }
        return output.toByteArray();
    }
    byte[] pdf(int pages, boolean text) throws Exception {
        try (PDDocument document = new PDDocument()) {
            for (int i=0; i<pages; i++) document.addPage(new PDPage());
            if (text) try (var stream = new PDPageContentStream(document, document.getPage(0))) {
                stream.beginText(); stream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12); stream.newLineAtOffset(40,700); stream.showText("Feynman learning document"); stream.endText();
            }
            var output = new ByteArrayOutputStream(); document.save(output); return output.toByteArray();
        }
    }
    byte[] image() throws Exception {
        var output = new ByteArrayOutputStream(); ImageIO.write(new BufferedImage(100,100,BufferedImage.TYPE_INT_RGB), "png", output); return output.toByteArray();
    }

    @Test void extractsWordParagraphsAndTableText() throws Exception {
        var response = service.parse(file("笔记.docx", docx("<w:document xmlns:w='http://schemas.openxmlformats.org/wordprocessingml/2006/main'><w:body><w:p><w:r><w:t>知识点标题</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格文字</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>")), false);
        assertEquals("笔记", response.title()); assertTrue(response.text().contains("知识点标题")); assertTrue(response.text().contains("表格文字")); verifyNoInteractions(ocr);
    }
    @Test void extractsTextPdfLocallyAndReportsBlankPages() throws Exception {
        var response = service.parse(file("note.pdf", pdf(2,true)), false);
        assertTrue(response.text().contains("Feynman learning document")); assertEquals(2,response.pages()); assertFalse(response.usedOcr()); assertFalse(response.warnings().isEmpty()); verifyNoInteractions(ocr);
    }
    @Test void scannedPdfRequiresConsentAndUsesOcr() throws Exception {
        byte[] data = pdf(1,false);
        assertEquals("OCR_CONSENT_REQUIRED", assertThrows(ApiException.class, () -> service.parse(file("scan.pdf",data),false)).getCode());
        when(ocr.recognize(any())).thenReturn("扫描识别文字");
        var response = service.parse(file("scan.pdf",data),true);
        assertTrue(response.usedOcr()); assertEquals("扫描识别文字",response.text()); verify(ocr).recognize(any());
    }
    @Test void rejectsTooManyPdfPagesBeforeOcr() throws Exception {
        byte[] data = pdf(21,false);
        assertEquals("TOO_MANY_PAGES",assertThrows(ApiException.class, () -> service.parse(file("long.pdf",data),true)).getCode()); verifyNoInteractions(ocr);
    }
    @Test void imagesSupportOcrOrAttachmentOnly() throws Exception {
        byte[] data=image();
        var attachment=service.parse(file("shot.png",data),false,true);
        assertTrue(attachment.imageDataUrl().startsWith("data:image/jpeg;base64,")); assertEquals("",attachment.text()); verifyNoInteractions(ocr);
        when(ocr.recognize(any())).thenReturn("截图中的文字");
        assertEquals("截图中的文字",service.parse(file("shot.png",data),true).text());
    }
    @Test void rejectsUnsupportedForgedAndOversizedFiles() {
        assertThrows(ApiException.class, () -> service.parse(file("program.exe",new byte[]{1}),false));
        assertThrows(ApiException.class, () -> service.parse(file("fake.png","not an image".getBytes()),true));
        assertThrows(ApiException.class, () -> service.parse(file("fake.pdf","not a pdf".getBytes()),false));
        assertEquals("FILE_TOO_LARGE",assertThrows(ApiException.class, () -> service.parse(file("big.txt",new byte[DocumentImportService.MAX_BYTES+1]),false)).getCode());
    }
    @Test void blocksExternalXmlEntities() throws Exception {
        byte[] malicious=docx("<!DOCTYPE x [<!ENTITY secret SYSTEM 'file:///does-not-exist'>]><w:document xmlns:w='w'><w:t>&secret;</w:t></w:document>");
        assertThrows(ApiException.class, () -> service.parse(file("unsafe.docx",malicious),false));
    }
    @Test void textLimitsAndUtf8AreEnforced() {
        assertEquals("学习内容",service.parse(file("note.txt","学习内容".getBytes(StandardCharsets.UTF_8)),false).text());
        assertThrows(ApiException.class, () -> service.parse(file("bad.txt",new byte[]{(byte)0xff}),false));
        assertEquals("TEXT_TOO_LONG",assertThrows(ApiException.class, () -> service.parse(file("long.txt","a".repeat(100001).getBytes()),false)).getCode());
    }
    @Test void embeddedImagesDoNotPolluteLearningText() {
        String value="<p>学习 &amp; 复述</p><p><img src='data:image/jpeg;base64,abcdef'></p>";
        assertEquals("学习 & 复述",LearningText.plain(value));
        assertFalse(new com.feynman.platform.rag.RagTextSplitter().split(value).toString().contains("base64"));
    }
    @Test void missingOcrConfigurationIsClear() {
        assertEquals("OCR_NOT_CONFIGURED",assertThrows(ApiException.class, () -> new BaiduOcrClient(new ObjectMapper(),"","").recognize(new byte[]{1})).getCode());
    }
}
