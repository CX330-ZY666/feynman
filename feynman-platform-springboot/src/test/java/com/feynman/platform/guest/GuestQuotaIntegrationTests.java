package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import javax.sql.DataSource;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.mybatis.spring.*;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import static org.junit.jupiter.api.Assertions.*;

@SpringJUnitConfig(GuestQuotaIntegrationTests.Config.class)
class GuestQuotaIntegrationTests {
    @Configuration @EnableTransactionManagement @MapperScan(basePackageClasses=GuestUsageMapper.class,annotationClass=org.apache.ibatis.annotations.Mapper.class)
    static class Config {
        @Bean DataSource dataSource(){var ds=new DriverManagerDataSource("jdbc:h2:mem:guestQuota;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","sa","");new JdbcTemplate(ds).execute("CREATE TABLE IF NOT EXISTS guest_usage(bucket_key VARCHAR(180) PRIMARY KEY,used_count INT NOT NULL,expires_at TIMESTAMP NOT NULL)");return ds;}
        @Bean SqlSessionFactoryBean sqlSessionFactory(DataSource ds){var factory=new SqlSessionFactoryBean();factory.setDataSource(ds);return factory;}
        @Bean DataSourceTransactionManager transactionManager(DataSource ds){return new DataSourceTransactionManager(ds);}
        @Bean GuestQuotaService quota(GuestUsageMapper mapper){return new GuestQuotaService(mapper,new GuestSettings(true,5,30,3,50),"quota-test-secret");}
    }
    @Autowired GuestQuotaService quota;@Autowired GuestUsageMapper mapper;@Autowired DataSource ds;
    @BeforeEach void clear(){new JdbcTemplate(ds).update("DELETE FROM guest_usage");}
    @Test void concurrentRequestsCannotExceedGuestBudget()throws Exception{
        try(var pool=Executors.newFixedThreadPool(8)){
            var futures=new java.util.ArrayList<Future<Boolean>>();
            for(int i=0;i<8;i++)futures.add(pool.submit(()->{try{quota.reserveAi("same-user","same-ip");return true;}catch(ApiException e){return false;}}));
            int successes=0;for(var f:futures)if(f.get())successes++;
            assertEquals(5,successes);assertEquals(0,quota.remaining("same-user"));
        }
    }
    @Test void globalLimitRejectionRollsBackOtherBuckets(){
        for(int user=0;user<6;user++)for(int call=0;call<5;call++)quota.reserveAi("u"+user,"ip"+user);
        assertThrows(ApiException.class,()->quota.reserveAi("new-user","new-ip"));
        assertNull(mapper.count("ai-user:new-user"));assertEquals(5,quota.remaining("new-user"));
        assertThrows(ApiException.class,()->quota.reserveEvaluation("new-user","new-ip"));
        assertEquals(1,quota.evaluationRemaining("new-user"));
    }
    @Test void learningWritesAreBoundedAndIsolated(){
        for(int i=0;i<100;i++)quota.reserveWrite("writer1");
        assertThrows(ApiException.class,()->quota.reserveWrite("writer1"));
        quota.reserveWrite("writer2");
        assertEquals(5,quota.remaining("writer1"));
    }
    @Test void fiveExchangesStillAllowOneSeparateFinalEvaluation(){
        for(int i=0;i<5;i++)quota.reserveAi("learner","ip");
        assertThrows(ApiException.class,()->quota.reserveAi("learner","ip"));
        assertEquals(1,quota.evaluationRemaining("learner"));
        quota.reserveEvaluation("learner","ip");
        assertEquals(0,quota.evaluationRemaining("learner"));
        assertEquals(0,quota.remaining("learner"));
        assertThrows(ApiException.class,()->quota.reserveEvaluation("learner","ip"));
    }
    @Test void concurrentEvaluationsCanOnlyUseOneSlot()throws Exception{
        try(var pool=Executors.newFixedThreadPool(4)){
            var futures=new java.util.ArrayList<Future<Boolean>>();
            for(int i=0;i<4;i++)futures.add(pool.submit(()->{try{quota.reserveEvaluation("learner","ip");return true;}catch(ApiException e){return false;}}));
            int successes=0;for(var f:futures)if(f.get())successes++;
            assertEquals(1,successes);assertEquals(5,quota.remaining("learner"));
        }
    }
    @Test void ipAndCreationLimitsSurviveServiceInstances(){
        for(int i=0;i<3;i++)quota.reserveSession("ip1");
        assertThrows(ApiException.class,()->quota.reserveSession("ip1"));
        quota.reserveSession("ip2");
        assertNotEquals(quota.ipHash("ip1"),quota.ipHash("ip2"));assertEquals(quota.ipHash("ip1"),quota.ipHash("ip1"));
    }
}
