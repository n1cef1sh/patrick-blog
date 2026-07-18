---
title: "SpringSecurity系列(二)"
date: 2021-04-01
draft: false
archive: true
slug: 2021-04-01-springsecurity-a2e22a95
badge: 旧文
tags:
  - "Java"
---
练习代码同步到github：SpringSecuritySamples/auto-login

## 自动登录

顾名思义，就是用户登录成功以后，在一段时间里浏览器保存用户的登录状态，如果用户关闭了浏览器再重新打开，或者重启了服务器，都不需要用户再次输入密码进行登录，就可以直接自动登录直接访问接口。

只要在Security-Config中添加一句代码

```java
@Override
protected void configure(HttpSecurity http) throws Exception {
    http.authorizeRequests()
            .anyRequest().authenticated()
            .and()
            .formLogin()
            .and()
            .rememberMe()//自动登录功能
            .and()
            .csrf().disable();
}
```

启动项目后，就多了一个Remember me的选项。

![image-20210401152755676](/images/legacy/2021-04-01-springsecurity-a2e22a95/001-0eb6dd215a.png)

勾选上登录，查看cookie

```xml
Cookie: Idea-5cccbd0c=05b8c6b5-e5de-4a5c-8f0a-0d354b3058b5; JSESSIONID=438EBD5C451B195DF99FE38AE9D5CC9D; remember-me=YmFkY2F0OjE2MTg0NzE2Nzc4Mzc6Njc4ZmFkZGNkOWE3YzAwZmM5YWIxODMzMjk5NzE1ODY
```

根据经验判断remember-me后面这段是base64编码，解码得到

```xml
badcat:1618471677837:678faddcd9a7c00fc9ab183329971586
```

- 第一个是用户名
- 第二个查询以后得知是一个时间戳，转换后是一个两周后的时间，应该指的是有效期
- 第三个一看很像md5处理后的值，而明文格式是 `username + ":" + tokenExpiryTime + ":" + password + ":" + key`，key是一个散列盐值，每次服务器重启都会变。

具体含义都是从对应源码TokenBasedRememberMeServices中得出的

```java
@Override
public void onLoginSuccess(HttpServletRequest request, HttpServletResponse response,
        Authentication successfulAuthentication) {
    String username = retrieveUserName(successfulAuthentication);
    String password = retrievePassword(successfulAuthentication);
    if (!StringUtils.hasLength(password)) {
        UserDetails user = getUserDetailsService().loadUserByUsername(username);
        password = user.getPassword();
    }
    int tokenLifetime = calculateLoginLifetime(request, successfulAuthentication);
    long expiryTime = System.currentTimeMillis();
    expiryTime += 1000L * (tokenLifetime < 0 ? TWO_WEEKS_S : tokenLifetime);
    String signatureValue = makeTokenSignature(expiryTime, username, password);
    setCookie(new String[] { username, Long.toString(expiryTime), signatureValue },
            tokenLifetime, request, response);
}
protected String makeTokenSignature(long tokenExpiryTime, String username,
        String password) {
    String data = username + ":" + tokenExpiryTime + ":" + password + ":" + getKey();
    MessageDigest digest;
    digest = MessageDigest.getInstance("MD5");
    return new String(Hex.encode(digest.digest(data.getBytes())));
}
```

知道了具体含义，我们就知道必须要自己设置一个key，不然每次重启服务器后之前的令牌都会失效。

```java
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
                .anyRequest().authenticated()
                .and()
                .formLogin()
                .and()
                .rememberMe()
                .key("badcat")
                .and()
                .csrf().disable();
    }
```

测试重启服务器后，仍可以直接访问到/hello。

Spring Security 的功能大多是通过一个过滤器链实现的，此处的原理也是通过RememberMeAuthenticationFilter 类来实现，暂且不表。

## 持久化令牌

之前的自动登录就是生成了一种令牌来实现功能，在此基础上提高安全性，增加校验参数，就是持久化令牌。但用户是感受不到二者的区别的。

这里持久化令牌的处理类是PersistentTokenBasedRememberMeServices，其中用来保存的是 PersistentRememberMeToken

```java
public class PersistentRememberMeToken {
    private final String username;
    private final String series;//只有当用户在使用用户名/密码登录时，才会生成或者更新
    private final String tokenValue;//只要有新的会话，就会重新生成，防止一个用户多端登录
    private final Date date;//上次登录的时间
    //省略其他
}
```

令牌信息需要我们准备一张表来存储，可以自定义或者使用默认的。

系统默认提供的数据库模型是JdbcTokenRepositoryImpl，根据结构创建数据表

```sql
CREATE TABLE `persistent_logins` (
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `series` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_used` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`series`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

然后改写SecurityConfig代码

```java
@Autowired
DataSource dataSource;
@Bean
JdbcTokenRepositoryImpl jdbcTokenRepository() {
    JdbcTokenRepositoryImpl jdbcTokenRepository = new JdbcTokenRepositoryImpl();
    jdbcTokenRepository.setDataSource(dataSource);
    return jdbcTokenRepository;
}
@Override
protected void configure(HttpSecurity http) throws Exception {
    http.authorizeRequests()
            .anyRequest().authenticated()
            .and()
            .formLogin()
            .and()
            .rememberMe()
            .key("javaboy")
            .tokenRepository(jdbcTokenRepository())
            .and()
            .csrf().disable();
}
```

新的cookie里remember-me的值

```xml
remember-me=JTJGU3JTcHVQd2JPN0ZSbkdJRkw2dmN3JTNEJTNEOiUyQkViRmFSMVNmS2k2cHg0MkFJMEtUUSUzRCUzRA
```

base64解码得到

```java
%2FSrSpuPwbO7FRnGIFL6vcw%3D%3D:%2BEbFaR1SfKi6px42AI0KTQ%3D%3D
```

再url解码后

```xml
/SrSpuPwbO7FRnGIFL6vcw==:+EbFaR1SfKi6px42AI0KTQ==
```

刚好对应保存到数据库的数据

![image-20210401161854655](/images/legacy/2021-04-01-springsecurity-a2e22a95/002-f10b0b3052.png)

*这一通解码让人想念起做ctf题目的时候……*



## 二次校验

万一令牌被人盗用，后果还是很严重的，虽然不能完全避免，但是我们可以想办法将损失降低。

二次校验就是如果使用了自动登录，只能进行一些普通操作，如果涉及到一些敏感操作的话，需要跳转回登录页面，重新输入密码来二次确认身份。

准备三个接口。

```java
@RestController
public class HelloController{
    @GetMapping("/hello")
    public String hello(){
        //任何类型的认证登录后都可以访问
        return "hello";
    }

    @GetMapping("/admin")
    public String admin(){
        //非自动登录可以访问
        return "admin";
    }

    @GetMapping("/rememberme")
    public String rememberme(){
        //只有自动登录可以访问
        return "rememberme";
    }
}
```

修改SecurityConfig

```java
    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
                .antMatchers("/rememberme").rememberMe()
                .antMatchers("/admin").fullyAuthenticated()//不包括自动登录
                .anyRequest().authenticated()
                .and()
                .formLogin()
                .and()
                .rememberMe()
                .key("badcat")
                .tokenRepository(jdbcTokenRepository())
                .and()
                .csrf().disable();
    }
```

测试后符合预期。

## 参考

[江南一点雨](http://itboyhub.com/category/springsecurity/)
