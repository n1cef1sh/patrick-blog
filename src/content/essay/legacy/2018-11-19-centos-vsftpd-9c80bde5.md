---
title: "小白Centos搭建vsftpd服务器踩坑"
date: 2018-11-19
draft: false
archive: true
slug: 2018-11-19-centos-vsftpd-9c80bde5
badge: 旧文
tags:
  - "工具与杂项"
---
# 前言

在centos7上搭建vsftpd服务器时遇到很多问题，综合查询和个人尝试解决了一些小坑。虽然对这方面接触不多，但是觉得有必要记录一下。

具体的配置过程有很多教程不再细表，只记载我踩到的坑和一些解决尝试。
# Failed to start Vsftpd ftp daemon
初次按照教程配置完毕后，输入

    systemctl restart vsftpd.service

重启ftp服务，但是此时报错。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/001-c2fe074aee.png)

按照提示查看具体报错

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/002-22ee3e91a4.png)

这里没显示全，Failed to start Vsftpd ftp daemon。
因为我没什么经验，所以费了不少工夫来尝试。不再详细记述过程了，记一下大概率有用的几个地方。

## 1、首先关闭防火墙和SELinux来测试最好，排除其他干扰因素。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/003-dc02cd6d3d.png)

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/004-285e001bcb.png)

## 2、检查端口占用问题
我这里没涉及到这个问题。
      
        netstat -ntlp|grep 21

## 3、检查配置文件
启动时的故障最大的可能还是配置文件里有错误，最好配置的时候手动输入，直接复制粘贴可能会出错，当然了自己输入也要睁大眼睛=-=。

1、listen=NO    

网上解决的方法里最多的就是说把配置文件/etc/vsftpd/vsftpd.conf里的listen=YES改成NO即可，但是我这里最后生效的设置里是listen=YES listen_ipv6=NO。当我的listen=NO时

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/005-40f050acc4.png)

具体原因不详，这个可以自己试试把这俩yes/no尝试下……

2、删除/etc/vsftpd/user_list里的root

3、虚拟用户密码最好是字母加数字

虽然不能确定纯数字是否一定会导致错误，但是为了安全也尽量不要用纯数字

4、文件名对应好

配置文件里有一些是例如user_ config_ dir=/etc/vsftpd/vsftpuser_ conf这样路径的配置，我一开始画蛇添足把vsftpuser_conf多加了个.conf的后缀，也是一个错误。

## 小结

关于这个错误，网上一搜一大堆，像我一样的小白还是常常会碰到这种配置错误。其实这个的配置文件并没有很复杂，在网上找一个比较规范的对照一下也可以，主要还是没有经验，所以在查找问题原因的时候有点无从下手。

可能还有其他问题或者我这里的方法并不适用所有人，个人谨慎尝试。


# 530 Login incorrect

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/006-e664e32609.png)

好不容易搭好了ftp服务器，正常启动了，于是兴冲冲的去登录测试。结果又是当头一棒，登录失败。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/007-0313601397.png)

这时候我们已经有一点点经验了，所以不要慌张，先看看具体错误原因。

pam_userdb(vsftpd:auth): user_lookup: could not open database `/etc/vsftpd/vsftpduser.db': No such file or directory

那么问题出在/etc/vsftpd/vsftpduser.db这个虚拟用户的数据库文件上，检查了一下这个文件是存在的，那么为啥找不到呢？

这里还是同样的问题，**不要乱加文件后缀**

认证文件vsftpduser后面没有".db" ，系统会自动增加的 ，如果加上 ".db" 将会出错 。我们去掉这个多余的后缀，即可登录成功。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/008-71519df564.png)

终于看到Login successful了。

# 553 Could not create file

登陆上以后我们总要做点事情测试，于是在home目录下新建了个test.txt，然后在home目录下登录ftp服务器，尝试上传文件。然而问题又来了。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/009-2ec02427f4.png)

直接put文件未果，即使像网上说的那样加个路径/home/test.txt也不行，只能暂时quit Goodbye再去查错啦。

这里其实是我的疏忽，前面测试的期间我重启了系统，但是没有再关闭selinux。这里只要关闭它即可。

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/004-285e001bcb.png)

其实selinux是一个 Linux 内核模块，也是 Linux 的一个安全子系统，按理说应该不能靠这么粗暴的关闭吧2333，但是就目前而言的问题来说，这个最高效了，也暂时没有什么影响（遇到影响再填坑呗）

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/010-43262abc11.png)

上传成功~

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/011-f6ac2c9e15.png)

查看目录

![](/images/legacy/2018-11-19-centos-vsftpd-9c80bde5/012-0c29d825fa.png)

测试下载也成功了

# ING

对于搭建服务器之类的我是小白中的小白，要不是linux课程设计可能我也不会尝试在centos下搭建vsftpd服务器。而且没想到一下子遇到好多错误，好在最后解决了，也不知道是否科学合理，但对于新手来说，重要的是积累经验吧，所以决定记录一下这几个小坑，如果以后再碰到类似的问题再做更新记录。

# 参考文章

[vsftpd登录时的典型错误](http://www.361way.com/ftp-error/1832.html)

[最有效的办法--VSFTP启动失败-Failed to start Vsftpd ftp daemon](https://blog.csdn.net/forwardlee163/article/details/80894876)
