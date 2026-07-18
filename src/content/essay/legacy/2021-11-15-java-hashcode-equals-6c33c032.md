---
title: "Java中的hashCode和equals方法"
date: 2021-11-15
draft: false
archive: true
slug: 2021-11-15-java-hashcode-equals-6c33c032
badge: 旧文
tags:
  - "Java"
---
### Object类

Java中所有的类都继承于Object类，当子类调用一个方法时，如果该方法没有被重写则需要往上面找到父类中的方法执行。而Object类中equals和hashcode的源码如下。

```java
 public boolean equals(Object obj) {
        return (this == obj);
 }
 public native int hashCode();

```

### hashcode

含义：散列码是用一个int值来代表对象，通过hash算法将该对象的某些有意义的信息进行转换生成。

**主要作用**是：为了配合基于散列的集合一起正常运行，这样的散列集合包括HashSet、HashMap以及HashTable。

从上面的源码可以看出hashCode()是一个本地方法，所以不同版本的Jvm可能会有不同的实现。不过一般默认的hashCode是根据对象的内存地址转化而来的。

```
java6、7默认是返回随机数
java8默认是通过和当前线程有关的一个随机数+三个确定值，运用Marsaglia’s xorshift scheme随机数算法得到的一个随机数
```

当向集合中put新元素时的过程是:

```
先调用hashCode方法得到该元素的hashCode值，然后查看table中是否存在该hashCode值，如果存在则调用equals方法重新确定是否存在该元素，如果存在，则更新value值，否则将新的元素添加到HashMap中。
```

由此可见，hashCode方法的存在是为了减少equals方法的调用次数，从而提高程序效率。

另外有一个问题，那就是：

```
hashcode可以用来判断对象不相等：对象A和对象B的hashcode不等，则A和B两个对象一定不相等；
hashcode不能用来判断对象相等:对象A和对象B不相等，但是两个对象的hashcode可能相等(也就是哈希碰撞)
```

因此在hashcode相等时，才需要再去调用equals方法判断是否对象真正相等。

### equals

equals必须严格地判断两个对象是否相同。

正确的equals方法有如下特性：

- 自反性：x.equals(x)一定返回true

- 对称性：如果x.equals(y)为true，那么y.equals(x)也为true

- 传递性：如果x.equals(y)为true、y.equals(z)为true,那么x.equals(z)也为true

- 一致性：如果x和y中用于等价比较的信息没有改变，那么x.equals(y)无论调用多少次，结果都一致

- 任何不是null的x，x.equals(null)一定返回false

那为什么要重写equals()方法呢？

因为我们在定义类时，**经常会希望两个不同对象的某些属性值相同时就认为他们相同**，而默认的equals方法是通过两个对象的内存地址来判断的，所以要重写equals()方法。

### 实际问题

之所以来了解Java中的hashCode和equals方法，是因为遇到了这样的实际问题：

```
在使用Hashmap时，如果用对象作为key，例如Hashmap<Object, String>。
```

这种情况下，必须重写该对象的hashCode和equals方法。而且必须同时都重写，否则会出现错误。

代码示例：

```java
class HashMapKey {
    private Integer id;
    public HashMapKey(Integer id) {
        this.id = id;
    }
    public Integer getId() {
        return id;
    }
}
public class demo {
    public static void main(String[] args) {
        HashMapKey k1 = new HashMapKey(1);
        HashMapKey k2 = new HashMapKey(1);
        HashMap<HashMapKey, String> map = new HashMap<>();
        map.put(k1, "testdemo");
        System.out.println("map.get(k2) : " + map.get(k2));
    }
}
//OUTPUT
//map.get(k2) : null
```

来捋一下这个过程。

当向HashMap里put放入k1时，会调用HashMapKey这个类的hashCode方法，计算出散列值hashcode。然后把k1放到hashcode指引的内存位置。显然HashMapKey这个类没有定义hashCode方法，故而调用父类Object类的hashCode方法，也就是k1对象的内存地址。

同理，如果将k2放入时也是同样的操作，而k1和k2的内存地址肯定是不同的，所以他们用默认的hashCode方法算出的散列值肯定也是不同的。

在调用HashMap::get方法时，会根据key的hashcode生成一个下标，但如果该下标对应有多个kv对(即形成拉链)，就会通过equals方法逐一判断拉链上的元素与get方法传进来的元素是否相等，如果相等，则get方法成功返回。

所以这里直接用k2作为key去取hashmap里的值，自然是找不到对应的值，只能返回null了。



但是只重写hashCode够用了吗？显然也不行，经过测试，还是null。

这里涉及到HashMap的数据结构问题，HashMap 是用链地址法来处理冲突。

例如下图，在 103号位置上，有可能存在着多个用链表形式存储的对象。它们通过 hashCode 方法返回的 hash 值都是 103。

![](/images/legacy/2021-11-15-java-hashcode-equals-6c33c032/001-562f6d14cc.png)



当我们通过 k2 的 hashCode 到 103号位置查找时，确实会得到 k1。但 k1 有可能仅仅是和 k2 具有相同的 hash值，但未必和 k2 相等。这个时候，就需要调用 HashMapKey 对象的 equals 方法来严格地判断两者是否相等了。

```
也就是前面提过的，hashcode不能用来判断对象相等，还是需要equals才可以。
```

而如果我们不重写equals 方法，就会默认调用父类Object的方法，根据两个对象的内存地址来判断，所以k1和k2一定不相等，也就无法通过k2取到k1对应的value了。



### When 

什么时候需要重写这两个方法呢？

首先对于equals方法，一般是为了满足业务需求从而重写equals比较的逻辑。

而hashCode方法从名字也能看得出来，是为了基于散列的集合（HashSet、HashMap以及HashTable）而设计的。也就是说，当我在对象A的类里重写了equals方法后，如果需要将对象A放入HashMap里，由于HashMap里的key不能相同（也就是没有重复元素），判断过程是

```
- 先根据hashCode方法得到的哈希值判断（为了提高程序效率，比直接用equals要快）
  - 如果哈希值不存在，则说明一定没有重复元素
  - 如果哈希值存在，根据哈希值找到对应内存位置。
    - 仍不能说明该位置的对象相等（存在哈希碰撞/冲突的可能），需要再通过equals方法判断    
       - 如果equals相等，则说明对象相等
       - 如果equals不等，则说明对象不相等
```

由此可见，HashMap的底层设计里第一步判断就是通过hashCode方法，后续再使用equals方法精准判断。所以为了HashMap的正常运行，如果重写了对象的equals，就必须也要重写hashCode方法。

再放一个网友画的图方便理解。

![](/images/legacy/2021-11-15-java-hashcode-equals-6c33c032/002-7c8025161b.png)

### How

可以看一下经典的String类里是怎么重写的。

boolean equals(Object anObject)

**是去判断两个字符串每一个字符是否相等，最精准的判断**

```java
public boolean equals(Object anObject) {
    //如果引用的是同一个对象，返回真
    if (this == anObject) {
        return true;
    }
    //如果不是String类型的数据，返回假
    if (anObject instanceof String) {
        String anotherString = (String) anObject;
        int n = value.length;
        //如果char数组长度不相等，返回假
        if (n == anotherString.value.length) {
            char v1[] = value;
            char v2[] = anotherString.value;
            int i = 0;
            //从后往前单个字符判断，如果有不相等，返回假
            while (n-- != 0) {
                if (v1[i] != v2[i])
                        return false;
                i++;
            }
            //每个字符都相等，返回真
            return true;
        }
    }
    return false;
}
```

int hashCode()

**根据字符串内容生成的一串数字，也就是说，一般情况下（这里就是指不出现不同元素相同散列值的情况）只要字符串的内容相等，那么这两个String对象的散列值就相同。**

```
public int hashCode() {
    int h = hash;
    //如果hash没有被计算过，并且字符串不为空，则进行hashCode计算
    if (h == 0 && value.length > 0) {
        char val[] = value;

        //计算过程
        //s[0]*31^(n-1) + s[1]*31^(n-2) + ... + s[n-1]
        for (int i = 0; i < value.length; i++) {
            h = 31 * h + val[i];
        }
        //hash赋值
        hash = h;
    }
    return h;
}
```



实际自己设计重写hashCode方法和equals方法的时候，不要依赖对象中易变的数据，同时让equals方法和hashCode方法始终在逻辑上保持一致性，这样就不会出现错误了。

例如学习笔记《SpringSecurity（四）》里最后重写User类里的hashCode方法和equals方法，都是依赖了不易变的username属性。

```java
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(username, user.username);
    }

    @Override
    public int hashCode() {
        return Objects.hash(username);
    }
```



### 小结

原理大概明白了，最后再引用几处书里的说法，加深一下理解。

1、《Java编程思想》

```
“设计hashCode()时最重要的因素就是：无论何时，对同一个对象调用hashCode()都应该产生同样的值。如果在讲一个对象用put()添加进HashMap时产生一个hashCdoe值，而用get()取出时却产生了另一个hashCode值，那么就无法获取该对象了。所以如果你的hashCode方法依赖于对象中易变的数据，用户就要当心了，因为此数据发生变化时，hashCode()方法就会生成一个不同的散列码”。
```

2、《Effective Java》中的通用约定

```
- 在程序执行期间，只要equals方法的比较操作用到的信息没有被修改，那么对这同一个对象调用多次，hashCode方法必须始终如一地返回同一个整数。(和上面那条是同一个意思)
- 如果两个对象根据equals方法比较是相等的，那么调用两个对象的hashCode方法必须返回相同的整数结果。
- 如果两个对象根据equals方法比较是不等的，则hashCode方法不一定得返回不同的整数。
```



在学习SpringSecurity使用的过程里发现了这个问题，本想按照教程一笔带过，却发现自己并不是很理解这部分原理。最后还是查阅了很多资料，结合编码实践，把这个问题算是搞清楚了。

反思了一下，虽然这样导致原本主线的学习路线效率降低了（因为容易”节外生枝“），但是究其原因还是自己的基础知识不够扎实，也就无法熟练地进行编码。

所以还是按照当前的节奏来吧，一边学习框架，一边补习基础知识点。

道阻且长，干就完事了。



### 参考

[彻底搞懂为什么重写equals还要重写hashcode？_初心JAVA-CSDN博客_为什么重写equals还要重写hashcode](https://blog.csdn.net/xl_1803/article/details/111941059)

[浅谈Java中的hashcode方法 - Matrix海子 - 博客园 (cnblogs.com)](https://www.cnblogs.com/dolphin0520/p/3681042.html)

[java面试题：hashMap为什么要重写equals，hashcode方法_我是方小磊的博客-CSDN博客](https://blog.csdn.net/weixin_44844089/article/details/103681519?spm=1001.2101.3001.6650.6&utm_medium=distribute.pc_relevant.none-task-blog-2~default~BlogCommendFromBaidu~default-6.essearch_pc_relevant&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2~default~BlogCommendFromBaidu~default-6.essearch_pc_relevant)
