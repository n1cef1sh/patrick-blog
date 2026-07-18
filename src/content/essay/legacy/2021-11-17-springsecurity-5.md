---
title: "SpringSecurity系列(五)"
date: 2021-11-17
draft: false
archive: true
slug: springsecurity-5
badge: 旧文
tags:
  - "Java"
---
### 两种资源放行方式

在之前学的security基础配置里，放行资源（无需登录即可访问）的方式有两种。

- 1、configure(WebSecurity web),在这里配置的话，就直接跳过了Spring Security 过滤器链。

  ```java
@Override
public void configure(WebSecurity web) throws Exception {
    web.ignoring().antMatchers("/css/**", "/js/**", "/index.html", "/img/**", "/fonts/**", "/favicon.ico", "/verifyCode");
}
  ```

- 2、configure(HttpSecurity http)，在这里配置的话，是在Spring Security 过滤器链中放行资源。

  ```java
  http.authorizeRequests()
          .antMatchers("/hello").permitAll()
          .anyRequest().authenticated()
  ```
  
  
  
  一般前端页面的静态资源直接用第一种方式放行就可以了，但是登录请求必须要走 Spring Security 过滤器链。因为SpringSecurity的核心就是各种过滤器，如果不走过滤器链，会跳过一些其他的关键过程。
  
  就拿登录请求来说，登录请求刚来的时候，还没有登录用户数据，但是登录请求结束的时候，会将用户登录数据存入 session 中，这样下个请求到来的时候，就可以直接取出来用了。
  
  而这个存入session的过程就是在过滤器链里完成的，如果不走过滤器链，那么登录成功后就不会将登录用户信息存入session，后续的其他请求也拿不到登录用户信息，也就是会被认作未经认证的请求。
  
  另外，虽然登录请求走了过滤器链，但如果后续的请求不走过滤器链的话，也无法正常拿到登录用户信息，因为这个也是在过滤器链中完成的。
  
  （突然想起来本科写SSM的时候，配置个这玩意可费劲了= =）
  
  

### 密码加密方式

原来的commons-codec需要自定义PasswordEncoder，还是有些麻烦。所以一般都用框架里的BCryptPasswordEncoder方式。

使用的时候很简单，只需要在PasswordEncoder里提供一个BCryptPasswordEncoder实例。

```java
    @Bean
    PasswordEncoder passwordEncoder(){
        //strength不写的话默认也是10，是密钥的迭代次数
        return new BCryptPasswordEncoder(10);
    }
```

以基于内存的用户为例，这里在测试类里先调用其中的encode方法，算出加密后的密码供测试用。

这里出现了第一个问题：

```
1、每次运行算出来的加密后字符串都是不同的（前7位相同，后面会解释）？
```

那么能用这个密码通过验证吗？

![](/images/legacy/springsecurity-5/001-d7e023bd74.png)

在内存里创建用户信息。

```java
    @Bean
    protected UserDetailsService userDetailsService(){
        InMemoryUserDetailsManager manager = new InMemoryUserDetailsManager();
        manager.createUser(User.withUsername("admin").password("$2a$10$TO4j6lUpQGeAkwxWG.ES3u3AtQfAqNUEXepakBIN3Ixu4qbSz08qi").roles("admin").build());
        manager.createUser(User.withUsername("badcat").password("$2a$10$EQu1Sp/LNriP3Hfl0xhvLe/2cASs080eUQR2sCMck0ENMnXrf9rtK").roles("user").build());
        return manager;
    }
```

其他基础配置不再赘述。如果是基于自定义的用户，也就是把用户信息存到数据库的话，只需要把前端传过来的密码用encode加密后存入数据库即可。

然后启动项目登录测试，登录成功，并且可以访问其他接口。

于是有了第二个问题：

```
2、为什么每次encode得到的密码都不一样，但是matches()却可以通过匹配验证呢？
```

首先BCryptPasswordEncoder类是实现了PasswordEncoder接口，而我们知道在 Spring Security 中，PasswordEncoder 专门用来处理密码的加密与比对工作，所以看一下这个接口里面有什么。(以下源码均出自Java1.8.0_201)

![](/images/legacy/springsecurity-5/002-522910b0eb.png)

其中encode()就是用来加密字符串的方法，而matches()方法则用来匹配密码是否正确。

upgradeEncoding 表示是否需要对密码进行再次加密以使得密码更加安全，默认为 false。

主要就是前两个方法，看一下BCryptPasswordEncoder类里的具体实现。

encode()

```java
    public String encode(CharSequence rawPassword) {
        if (rawPassword == null) {
            throw new IllegalArgumentException("rawPassword cannot be null");
        } else {
            String salt = this.getSalt();
            return BCrypt.hashpw(rawPassword.toString(), salt);
        }
    }
```

getSalt()

```java
    private String getSalt() {
        return this.random != null ? BCrypt.gensalt(this.version.getVersion(), this.strength, this.random) : BCrypt.gensalt(this.version.getVersion(), this.strength);
    }
```

rawPassword就是传入的原始密码，salt则是加密中使用的“盐值”。使用getSalt()算出一个salt后，调用BCrypt.hashpw(rawPassword.toString(), salt)进行编码，至于这个hashpw()后面再看。

matches()

```java
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (rawPassword == null) {
            throw new IllegalArgumentException("rawPassword cannot be null");
        } else if (encodedPassword != null && encodedPassword.length() != 0) {
            if (!this.BCRYPT_PATTERN.matcher(encodedPassword).matches()) {
                this.logger.warn("Encoded password does not look like BCrypt");
                return false;
            } else {
                return BCrypt.checkpw(rawPassword.toString(), encodedPassword);
            }
        } else {
            this.logger.warn("Empty encoded password");
            return false;
        }
    }
```

其中校验密码时使用了checkpw()方法

```
public static boolean checkpw(String plaintext, String hashed) {
    return equalsNoEarlyReturn(hashed, hashpw(plaintext, hashed));
}
```

由于hash处理是不可逆的，所以不能将加密后的字符串解密，只能将明文再用同样的方法加密后，比较两个加密后的结果。这里hashpw(plaintext, hashed)是直接把之前用户注册时加密后的密码作为了salt参数传入，而核心方法就是这个hashpw()。

```
public static String hashpw(byte[] passwordb, String salt) {
    char minor = 0;
    StringBuilder rs = new StringBuilder();
    if (salt == null) {
        throw new IllegalArgumentException("salt cannot be null");
    } else {
        int saltLength = salt.length();
        if (saltLength < 28) {
            throw new IllegalArgumentException("Invalid salt");
        } else if (salt.charAt(0) == '$' && salt.charAt(1) == '2') {
            byte off;
            if (salt.charAt(2) == '$') {
                off = 3;
            } else {
                minor = salt.charAt(2);
                if (minor != 'a' && minor != 'x' && minor != 'y' && minor != 'b' || salt.charAt(3) != '$') {
                    throw new IllegalArgumentException("Invalid salt revision");
                }

                off = 4;
            }

            if (salt.charAt(off + 2) > '$') {
                throw new IllegalArgumentException("Missing salt rounds");
            } else if (off == 4 && saltLength < 29) {
                throw new IllegalArgumentException("Invalid salt");
            } else {
                int rounds = Integer.parseInt(salt.substring(off, off + 2));
                
                //关键的地方
                String real_salt = salt.substring(off + 3, off + 25);
                byte[] saltb = decode_base64(real_salt, 16);
                if (minor >= 'a') {
                    passwordb = Arrays.copyOf(passwordb, passwordb.length + 1);
                }

                BCrypt B = new BCrypt();
                byte[] hashed = B.crypt_raw(passwordb, saltb, rounds, minor == 'x', minor == 'a' ? 65536 : 0);
                rs.append("$2");
                if (minor >= 'a') {
                    rs.append(minor);
                }

                rs.append("$");
                if (rounds < 10) {
                    rs.append("0");
                }

                rs.append(rounds);
                rs.append("$");
                encode_base64(saltb, saltb.length, rs);
                encode_base64(hashed, bf_crypt_ciphertext.length * 4 - 1, rs);
                return rs.toString();
            }
        } else {
            throw new IllegalArgumentException("Invalid salt version");
        }
    }
}
```

前面一大堆用来校验getSalt得到的salt是否有效，规则大概是salt前7位是校验位，而第8位到30位是**real_salt**，将real_salt传入decode_base64方法进行转码，得到长度16的字节数组saltb。

接着就是核心的加密部分：将saltb和passwordb字节数组(也就是用户登录时输入的原始密码password转成的字节数组)传入crypt_raw()方法进行加密操作（网上说这就是SHA-256加密）生成字节数组hashed，这也就是所谓的hash值。

最后将saltb和hash值分别进行encode_base64方法进行Base64编码，这里要注意的是，saltb当初是怎么来的？就是通过decode_base64(real_salt)得来的，所以encode_base64(saltb)也就是又变成了最初的real_salt字符串。把这两部分产生的结果拼接到7位校验位之后，得到60位的字符串。显而易见的，这个字符串里前7位是校验位，第8位到30位是real_salt。也就是说生成的最终字符串里是带着本次加密所用的real_salt的。

明白了原理之后，再回到问题中来。以最开始的截图里生成的密码为例，这是用户注册时生成的密码，我们叫它P1，保存至内存或者数据库里。

```java
$2a$10$5tuWek/2QSUVcjUrpP.2vemGs3/s16wfrO9KEezlr1Prb8j/qLriy
```

当用户注册完成后，使用原始密码(我们叫它P2)登录系统时，系统调用了BCryptPasswordEncoder的matches方法，去比较P1和hashpw(P2, P1)是否相等，相等则通过验证。

而hashpw(P2,P1)这个方法，则是把P1当作了salt值，去对P2加密。加密的核心点前面已经说过了，就是把saltb和passwordb传入crypt_raw()方法。而saltb则是通过第8-22位的real_salt转换得到的字节数组。

注册时生成的密码P1里包含了当时所用的real_salt，而登录验证时把P1作为盐值参数传入后，按规则取到的real_salt和注册时使用的real_salt自然是相同的。

到这里我们就可以解决之前的两个问题了。

1、每次encode()算出来的加密后字符串都是不同的（但是前7位相同）？

encode()时每次生成的salt是一个随机值，传入hashpw()后截取的real_salt也是不同的，所以加密得到的字符串是不同的。而前7位是校验码，包括salt的version和rounds，同样的版本和轮次自然是相同的。

2、为什么每次encode得到的密码都不一样，但是matches()却可以通过匹配验证呢？

前面已经解释了，注册和登录两次调用hashpw()方法，使用的是同样的加密算法，同样的原始密码，和同样的real_salt，所以得到的最终字符串当然是相同的，可以通过密码匹配验证。



### 小结

1、资源放行是比较常见常用的设置，具体实践中再具体积累。

2、这个密码加密的方式，最初学习时只想简略地过一下源码，结果看着看着找到了一些当年学逆向分析时候的感觉……

当时去逐行分析base64编码，md5编码，学习各种常用的加密算法，虽然枯燥但是也乐在其中。后来自己没有坚持走下去，现在看来终归还是自己太浮躁，无法耐下心来去认真分析一个程序，偶尔的投机取巧尝到了甜头，却也让自己在错误的道路上越走越远。

曾经还是有些不甘心的，但是现在我愿意正面自己的失败：当时没有取得成绩是必然的结果。无论是做安全，还是做开发，我都没有足够的认真和足够的深入，浮在表面，随时都会翻船。

不多唠叨了，继续学习吧。





###  参考

[Spring Security 两种资源放行策略，千万别用错了！ - 江南一点雨 (javaboy.org)](http://www.javaboy.org/2020/0528/springsecurity-ignoring.html)

[Spring Boot 中密码加密的两种姿势！ - 江南一点雨 (javaboy.org)](http://www.javaboy.org/2020/0521/springsecurity-passwordencoder.html)

[SpringSecurity中的Bcrypt加密方法源码解析 - 简书 (jianshu.com)](https://www.jianshu.com/p/5c2fee00d527)

[Spring Security PasswordEncoder 密码校验和密码加密流程 - 简书 (jianshu.com)](https://www.jianshu.com/p/922963106729)
