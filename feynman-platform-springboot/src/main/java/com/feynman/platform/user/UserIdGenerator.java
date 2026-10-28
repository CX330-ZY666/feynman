package com.feynman.platform.user;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

@Component
public class UserIdGenerator {
    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private final SecureRandom random = new SecureRandom();

    public String nextId() {
        byte[] bytes = new byte[12];
        random.nextBytes(bytes);
        char[] result = new char[24];
        for (int index = 0; index < bytes.length; index++) {
            int value = bytes[index] & 0xff;
            result[index * 2] = HEX[value >>> 4];
            result[index * 2 + 1] = HEX[value & 0x0f];
        }
        return new String(result);
    }
}
