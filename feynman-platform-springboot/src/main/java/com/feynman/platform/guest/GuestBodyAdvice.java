package com.feynman.platform.guest;

import java.io.*;
import java.lang.reflect.Type;
import org.springframework.core.MethodParameter;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.RequestBodyAdviceAdapter;
import com.feynman.platform.common.ApiException;

@ControllerAdvice
public class GuestBodyAdvice extends RequestBodyAdviceAdapter {
    @Override public boolean supports(MethodParameter parameter,Type type,Class<? extends HttpMessageConverter<?>> converter){return GuestExecution.active();}
    @Override public HttpInputMessage beforeBodyRead(HttpInputMessage message,MethodParameter parameter,Type type,Class<? extends HttpMessageConverter<?>> converter)throws IOException {
        InputStream bounded=new FilterInputStream(message.getBody()){
            int count;
            private void add(int value){if(value>0&&(count+=value)>16384)throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE,"GUEST_BODY_LIMIT","体验模式仅支持短文本，请缩短内容或注册正式账号");}
            @Override public int read()throws IOException{int value=in.read();if(value>=0)add(1);return value;}
            @Override public int read(byte[] b,int off,int len)throws IOException{int value=in.read(b,off,len);add(value);return value;}
        };
        return new HttpInputMessage(){public InputStream getBody(){return bounded;}public HttpHeaders getHeaders(){return message.getHeaders();}};
    }
}
