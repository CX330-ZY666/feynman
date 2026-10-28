package com.feynman.platform.importing;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/knowledge-points/import")
public class DocumentImportController {
    private final DocumentImportService service;
    public DocumentImportController(DocumentImportService service) { this.service = service; }

    @PostMapping(consumes = "multipart/form-data")
    public DocumentImportResponse parse(@RequestPart("file") MultipartFile file,
            @RequestParam(defaultValue = "false") boolean allowOcr,
            @RequestParam(defaultValue = "false") boolean imageOnly) {
        return service.parse(file, allowOcr, imageOnly);
    }
}
