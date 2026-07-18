---
title: "GitHub Pages failed to build your site"
date: 2020-12-01
draft: false
archive: true
slug: 2020-12-01-github-pages-failed-to-build-your-site-0a312e37
badge: 旧文
tags:
  - "工具与杂项"
---
## 报错
自从更新了一篇学习博客后，疯狂报错。  

The tag extends on line 5 in _posts/2020-11-30-flask-web学习记录.md is not a recognized Liquid tag.  

改着改着突然9.24的Vue学习记录也开始报错，索性把所有引用的代码全部删除了，不知道为什么突然md格式上传时会出现冲突和错误，也不太想深究了。  

突然myVue库也报错了……可能是因为最近刚把他从private设成了public，所以检测出了不安全的代码部分，也直接把该目录删除了。  

但是flask-web这里的错误一直不知道为什么，尝试了几十次commit，未果。直接删除了那个md，然后现在来写个乱七八糟不知所以的博文，试试到底能不能成功上传了。

来引用一段代码试试。

    why so serious


## 寻因


很迷惑，成功了。那我再把之前失败的那篇拿过来试一下,还是报错。

The tag extends on line 51 in _posts/2020-11-30-flask-web学习.md is not a recognized Liquid tag.

在GitHub desktop上commit时发现有个黄色三角警告

> warning: LF will be replaced by CRLF

大致的检索了一下，在Windows环境中，换行符是CRLF，也就是\r\n，但是在Linux环境中，换行符是LF，也就是\n，但git在维护版本库的时候统一使用的是LF，这样就可以保证文件跨平台的时候保持致。但导致window下的换行符与git下不一致，这样就会弹出警告。

但这似乎应该不是问题所在，每次更新博文的步骤都是相同的，有道云编写md，放到blog/_post下进行上传。

还是回到报错的根本之处， tag extends不是一个可识别的liquid tag。

> What is Liquid?
> 
> Liquid is an open-source template language created by Shopify and written in Ruby. 
> It is the backbone of Shopify themes and is used to load dynamic content on storefronts.
> 
> Liquid has been in production use since June 2006 and is now used by many other hosted web applications.

Liquid是一种开源模板语言，由 Shopify 创建，用 Ruby 编写，用于在网站加载动态内容。

所以tag extends是个什么东西？

![image.png](/images/legacy/2020-12-01-github-pages-failed-to-build-your-site-0a312e37/001-a3a2946430.png)

于是又重新把这几行给删掉，错误解决了……感觉很迷惑，之前我删的干干净净，只剩下标题和分类设置了，还在报错The tag extends on line 5 in _posts/2020-11-30-flask-web.md is not a recognized Liquid tag.结果现在又突然好了……  


## 反思

遇到问题不能上头，还是要从报错信息入手，多次尝试。这么一点小问题提交了几十次，方向越来越偏，还是回到最初的落脚点才解决掉，虽然还是不明白一开始删除为什么不可以。  

还有就是涉及到html的代码展示时候，尽量不要引用，使用截图或者简要说明，防止出现稀奇古怪的问题和错误，真是又糟心又浪费时间啊。

博客最重要的是记录学习和思考的过程，少做无用功。
