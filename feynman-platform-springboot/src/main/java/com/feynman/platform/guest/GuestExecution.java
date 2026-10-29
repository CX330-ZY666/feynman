package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.web.context.request.*;

public final class GuestExecution {
    private GuestExecution() {}
    public static boolean active() {
        var attrs=RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes request && Boolean.TRUE.equals(request.getRequest().getAttribute("feynman.guest"));
    }
    public static String prompt(String value) {
        if(!active())return value;
        var request=((ServletRequestAttributes)RequestContextHolder.currentRequestAttributes()).getRequest();
        Integer count=(Integer)request.getAttribute("feynman.guestProviderCalls");
        if(count!=null&&count>=2)throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"GUEST_PROVIDER_LIMIT","本次体验操作的AI调用次数已达上限");
        request.setAttribute("feynman.guestProviderCalls",count==null?1:count+1);
        return value.substring(0,Math.min(8000,value.length()));
    }
}
