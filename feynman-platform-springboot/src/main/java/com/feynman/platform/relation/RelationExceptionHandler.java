package com.feynman.platform.relation;

import com.feynman.platform.common.ErrorResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = KnowledgeRelationController.class)
public class RelationExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(RelationExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception) throws Exception {
        if (exception instanceof com.feynman.platform.common.ApiException apiException) {
            throw apiException;
        }
        log.error("知识关系接口执行失败", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ErrorResponse.of("Server Error", "RELATION_INTERNAL_ERROR"));
    }
}
