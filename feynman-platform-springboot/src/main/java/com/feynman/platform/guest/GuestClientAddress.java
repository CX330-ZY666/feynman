package com.feynman.platform.guest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

/** Trust the last XFF hop only when the actual socket peer is our local Nginx. */
public final class GuestClientAddress {
    private GuestClientAddress() {}
    public static String from(HttpServletRequest request) {
        HttpServletRequest raw=request;
        while(raw instanceof HttpServletRequestWrapper wrapper && wrapper.getRequest() instanceof HttpServletRequest inner) raw=inner;
        String peer=raw.getRemoteAddr();
        if("127.0.0.1".equals(peer)||"::1".equals(peer)||"0:0:0:0:0:0:0:1".equals(peer)) {
            String forwarded=request.getHeader("X-Forwarded-For");
            if(forwarded!=null&&forwarded.length()<2048) {
                String[] hops=forwarded.split(",");String last=hops[hops.length-1].trim();
                if(last.matches("[0-9a-fA-F:.]{3,64}")) return last;
            }
        }
        return peer==null?"unknown":peer;
    }
}
