---
title: "Android so文件解析"
date: 2018-08-04
draft: false
archive: true
slug: 2018-08-04-android-so-c77cdc4e
badge: 旧文
tags:
  - "网络安全"
---
# About so#
so（shared object，共享库）是机器可以直接运行的二进制代码，是Android上的动态链接库，类似于Windows上的dll。每一个Android应用所支持的ABI是由其APK提供的.so文件决定的，这些so文件被打包在apk文件的lib/目录下。
# Why so#

- so机制让开发者最大化利用已有的C和C++代码，达到重用的效果。
- so是二进制，没有解释编译的开销，用so实现的功能比纯java实现的功能要快；
- so内存分配不受Dalivik/ART的单个应用限制，减少OOM(OutOfMemory)；
- 相对于java代码，二进制代码的反编译难度更大，一些核心代码可以考虑放在so中。

# About ELF#
so文件的本质就是ELF，所以来了解并分析一下ELF文件。

##  基本概念##
ELF(Executable and Linking Format)是一种对象文件的格式，用于定义不同类型的对象文件(Object files)中都放了什么东西、以及都以什么样的格式去放这些东西。组成部分有：文件头Header，段表Section，程序头Segment(权限相同又连在一起的段)

对象文件主要分为三类。

- 可重定位的对象文件(Relocatable file)：即.o文件，通过链接处理可生成后两类中的一种。.ko文件也属于此类。
- 可执行的对象文件(Executable file)：linux下可执行的东西，但不包括脚本，脚本只是文本文件。
- 可被共享的对象文件(Shared object file)：即so文件。

另外核心转储文件(Core Dump File)也属于对象文件，当进程意外终止，系统可以将该进程地址空间的内容及终止时的一些信息转存到核心转储文件。因为目前涉及的不多，不过多了解。

##  具体分析##
随便拿了一个so文件具体看一下结构，用到命令readelf，Windows下使用需要下载Cygwin，这里我直接在Linux里使用。

### 文件头Header###
![](/images/legacy/2018-08-04-android-so-c77cdc4e/001-03bd56a799.png)
可以看到很丰富的Header信息

- Magic的前四字节是魔数，对应ASCII码就是?ELF,帮助识别文件类型。后面01 01 01 00 00 分别对应下面的类别/数据/版本/ABI或OS/ABI版本，至于ABI(Application Binary Interface)就是应用程序二进制接口。
剩下的是e_ ident数组预留空间的开始，其后都填充为0。
- 出现在最开始的Magic
总共16个字节，对应结构体里的e_ident数组，它用来标识ELF文件的平台属性，比如字长，字节序，ELF 文件版本等。在加载的时候，首先会确认Magic的正确性，不正确的话就拒绝加载。

我们再结合一下Header的结构来看。路径是/usr/include/elf.h
![](/images/legacy/2018-08-04-android-so-c77cdc4e/002-0063fda3b6.png)
e_ident已经分析过了，前几个也都很好理解，主要介绍几个重要的字段。

- e_phoff：程序头在整个文件里的偏移值，可用来定确定程序头的开始位置。
- e_shoff：段头在整个文件的偏移值，可用来确定段头的开始位置
- e_phnum：程序头个数
- e_shnum：段头个数
- e_shstrndx：String段在整个段列表里的索引值，可用来定位String段位置，这里26表示的是Section Header Table中第26项是字符串表（String Table）

### 节区头SectionHeader###
![](/images/legacy/2018-08-04-android-so-c77cdc4e/003-167f6c91f5.png)
这个so里包含了27个section，开始的偏移量是0x5a268也就是前面start of section headers的369256。

section head table(SHT)中，针对每一个section，都设置有一个条目用来描述对应的这个section，其内容主要包括该 section 的名称、类型、大小以及在整个ELF文件中的字节偏移位置等等。还是在elf.h里找到数据结构。都是和上面对应的，这里不做具体分析，以后再具体分析几个重要的节表，并且有基于对section的加密实现对so文件的加固操作。
![](/images/legacy/2018-08-04-android-so-c77cdc4e/004-cf74c30829.png)

### 程序头ProgramHeader###
![](/images/legacy/2018-08-04-android-so-c77cdc4e/005-658122973b.png)
查看共有8个程序头，且给出了section和segment的映射关系。同时在elf.h里找到对应的数据结构，注释的很清晰。其中只有LOAD类型的需要被映射加载。

可执行文件或者共享目标文件的程序头部是一个结构数组，每个结构描述了一个段或者系统准备程序执行所必须的其他信息。目标文件的“段”包含一个或者多个“节区”，也就是“段内容（Segment Contents）”。程序头部仅对可执行文件和共享目标文件有意义。
![](/images/legacy/2018-08-04-android-so-c77cdc4e/006-657c58b132.png)

### 小结###
整个elf文件的组成可以用下图描述
![](/images/legacy/2018-08-04-android-so-c77cdc4e/007-195e63adfd.png)

ELF文件内容有两个平行视角：程序链接视图和程序运行（装载）视图。而关于节和段，学过操作系统里的分段/分页存储管理会容易理解一些。

- 链接视图：链接器从链接的角度看待静态的ELF文件。从链接视图看ELF文件，ELF文件由多个section组成，不同的section拥有不同的名称，权限。section header table包含每一个section的入口，给出名字、大小等信息。
- 运行（装载）试图：操作系统从加载ELF文件到内存的角度看待动态的ELF文件。从装载视图看ELF文件，ELF文件由多个segment组成，每一个segment都拥有不同的权限，名称。Program header table指出怎样创建进程映像，含有每个program header的入口。


简单理清一下ELF文件装载的过程。(大概流程，忽略链接等)

- 读取文件头并解析，看magic的基本信息是否正确。
- 从文件头中定位到程序头并解析
- 获取到LOAD类型的segment
- 将其映射到内存空间，对于memsiz大于filesiz的部分全部填充为0
- 跳转到入口地址EntryPoint

# 回到So#
1、so动态库文件发挥作用都要经过两个过程

- 编译阶段。链接编辑器(link editor)拿它和其他Relocatable object file以及其他shared object file作为输入，经链接处理后，生成另外的 shared object file 或者 executable file。

- 运行阶段。动态链接器(dynamic linker)拿它和一个executable file以及另外一些 shared object file 来一起处理，在Linux系统里面创建一个进程映像。

2、Android中so的加载有两种方法

- System.loadLibrary：这是比较常用的方法，目前我也只尝试过这个方法。例如我们的so文件名字是libhello.so，加载时我们只需写成`System.loadLibrary("hello");`系统会自动补全名字并去寻找它然后加载。
- System.load：这个方法可以用来指定要加载的so文件路径从而动态的加载so文件，比如某个apk在打包时并没有打包so文件，而是在运行时将当前设备适用的so文件从服务器中下载下来放到某个路径下，然后使用so文件时去调用它。

两种方法最终都会调用nativeLoad(name, loader, ldLibraryPath)方法，只是因为loadLibrary的参数是so的文件名，所以需要首先找到这个文件的路径，然后加载这个so文件。
而load传入的参数是一个文件路径，所以它不需要去寻找这个文件路径，而是直接通过这个路径来加载so文件。


# 总结#
原来对于文件结构这些东西比较头大，在学习PE文件结构时也并没有认真总结，只是泛泛地过了一遍，所以导致有些地方一直模糊混淆。这次参考了很多文章和资料，较为完整地把elf格式分析了一遍，发现这些东西很重要也很有用，了解了它的本质东西，再去处理关于它的加密修复之类的问题就会思路更清晰，也有更多切入点。另外很深的体会就是，学好操作系统是非常重要的，文件结构等静态分析我们可以做到，但是涉及到动态加载运行的问题时，就必须了解操作系统里的原理。这部分还要不断总结学习。

这篇笔记里记录了so文件分析的大概流程，有一些更具体的部分，比如部分重要节表的分析并未涉及，会在后续关于“基于so中的section加密实现so加固”的笔记里再来记录。

虽然参考了很多文章资料，但是由于自己的认知理解仍不够深刻，难免还会有错误或者不当之处，望斧正。
# 参考#

《Android应用安全防护和逆向分析》

[https://blog.csdn.net/michael1112/article/details/54579911](https://blog.csdn.net/michael1112/article/details/54579911)

[https://blog.csdn.net/muaxi8/article/details/79627859](https://blog.csdn.net/muaxi8/article/details/79627859)

[https://www.cnblogs.com/LiuYanYGZ/p/5574602.html](https://www.cnblogs.com/LiuYanYGZ/p/5574602.html)

[https://blog.csdn.net/feglass/article/details/51469511](https://blog.csdn.net/feglass/article/details/51469511)
