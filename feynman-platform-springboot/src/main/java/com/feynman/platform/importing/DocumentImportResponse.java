package com.feynman.platform.importing;

import java.util.List;

public record DocumentImportResponse(String title, String text, String filename, String type,
                                     int pages, boolean usedOcr, String imageDataUrl, List<String> warnings) {}
