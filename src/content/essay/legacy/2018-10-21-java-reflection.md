---
title: "Java里的反射机制"
date: 2018-10-21
draft: false
archive: true
slug: java-reflection
badge: 旧文
tags:
  - "Java"
---
# 基本介绍
反射主要是指程序可以访问、检测和修改它本身状态或行为的一种能力。在计算机科学领域，反射是一类应用，它们能够自描述和自控制。这类应用通过某种机制来实现对自己行为的描述和检测，并能根据自身行为的状态和结果，调整或修改应用所描述行为的状态和相关的语义。

Reflection 是 Java 程序开发语言的特征之一，它允许运行中的 Java 程序对自身进行检查，或者说“自审”，并能直接操作程序的内部属性和方法。

它被视为准动态语言的关键性质。Java反射机制的核心就是允许在运行时通过Java Reflection APIs来取得已知名字的class类的相关信息，动态地生成此类，并调用其方法或修改其域（甚至是本身声明为private的域或方法）。

从名字来说，既然是反射，就肯定先有“正”。而“正”就是指，我们在使用一个类的时候，首先要知道这个类，通过这个类来创建实例化对象。那么“反”就是指，我们通过对象去找到它所属的类。

说到对象，它在运行时有两种类型。

- 编译时类型：堆内存里没还有给该对象创建内存，只是在栈里创建了一些基本类型的变量和引用，就是在new对象之前被加载到栈里的属性 或方法。
- 运行时类型：new出一个对象，在堆里分配了内存。此时的类型是new对象的属性和方法。

即 **对象调用编译时类型的属性和运行时类型的方法**

举一个例子来理解：

    Person p = new Student();
	//Student类继承自Person类

Java程序状态分为编译和运行。编译时,JVM在栈里静态创建基本数据变量和引用，这里p这个引用就是编译时创建的，所以p的编译时类型就是Person。而该行代码运行时，JVM在堆里为p创建了一块内存，对应着new Student()这句代码，所以p的运行时类型是Student。

那么说回正题。

# Class类

提到反射机制，首先我们要了解Class类。
当时初学Java的时候，只是有个大概的认识，对于Class类并没有在意，翻看了好几篇文章，整理一下现在的理解。

在Java中，每个class都有一个相应的Class对象。也就是说，当我们编写一个类，编译完成后，在生成的.class文件中，就会产生一个Class对象，用于表示这个类的类型信息。

类加载一共有5步，加载，验证，准备，解析和初始化。其中加载阶段，除了将字节码加载到方法区，还生成了这个类的Java.lang.Class对象。（关于类加载另外单独做笔记）

Class类说白也是一个类，只不过是在类加载过程中由虚拟机生成的特殊的类。Java是面向对象编程的，几乎所有数据都是对象，所以知道自己是哪种类型的对象是很必要的，而Class类就可以代表一个类的类型信息，里面存储了对应类的几乎所有的信息，当然这些信息是未初始化的信息，比如所有的方法，所有的构造函数，所有的字段（成员属性）等等。能够实现它所代表的这个类的所有功能，包括创建这个类的实例，获得所有的构造函数，方法，字段值等等，可以说无所不能。

图源http://www.cnblogs.com/crazypebble/archive/2011/04/13/2014582.html
![](/images/legacy/java-reflection/001-85e34232a0.png)

如图，获取Class对象的方法有很多种。

# 实例
使用java的反射一般需要三步。

- 1、获得该类的Class对象，也就是上图的那些方法
- 2、通过第一步获得的Class对象取得操作类的方法或者属性
- 3、操作第二步取得的方法或者属性

首先写个Person类

    package com.fish.test;

	public class Person {
	private String name = "nicefish";
	private int age = 20;

	
	public Person() {
		System.out.println("我是无参构造方法");
	}

	public Person(String name, int age) {
		this.name = name;
		this.age = age;
	}
	
	public String getName() {
		return name;
	}
	public void setName(String name) {
		this.name = name;
	}
	public int getAge() {
		return age;
	}
	public void setAge(int age) {
		this.age = age;
	}
	
	@Override
	public String toString() {
		return "Person [name=" + name + ", age=" + age +"]";
	}
	
	private void privateMethod() {
		System.out.println("我是私有方法");
	}
    }

然后是几个基本操作。


    
    	public class Reflect1 {
    	public static void main(String[] args) throws ClassNotFoundException, InstantiationException, IllegalAccessException, NoSuchMethodException, SecurityException, NoSuchFieldException {
    		//取得Class对象
    		Class<?> cls = Class.forName("com.fish.test.Person");
    		//反射实例化对象
    		Object obj = cls.newInstance();
    		System.out.println(obj.toString());
    		//获得构造方法
    		Constructor<?> cons = cls.getConstructor(String.class, int.class, String.class);
    		//获得get方法
    		Method m0 = cls.getDeclaredMethod("getName");
    		//获得name属性
    		Field  nameField =  cls.getDeclaredField("sex");
    	}}

![](/images/legacy/java-reflection/002-7c5c25c19d.png)

		Constructor<?> cons = cls.getConstructor(String.class, int.class);

起初有报错，原因是获得构造方法的时候参数个数没有对应起来。

修改后输入为

    我是无参构造方法
    Person [name=nicefish, age=20]

下面再分别测试几种操作。

## 获取方法Method

    package com.fish.test;

	import java.lang.reflect.InvocationTargetException;
	import java.lang.reflect.Method;

	public class getMethod {
	public static void main(String[] args) throws ClassNotFoundException, InstantiationException, IllegalAccessException, NoSuchMethodException, SecurityException, IllegalArgumentException, InvocationTargetException {
		
		//该方法是获取本类以及父类或者父接口中所有的公共方法(public修饰符修饰的)
		Class<?> cls = Class.forName("com.fish.test.Person");
		Method []methods = cls.getMethods();
		for (Method method : methods) {
			//System.out.println(method.getName() + ", ");
		}	
		
		
		//该方法是获取本类中的所有方法，包括私有的(private、protected、默认以及public)的方法。
		Method []methods2 = cls.getDeclaredMethods();
		for(Method method2 : methods2) {
			//System.out.println(method2.getName() + ", ");
		}
		
		//获得指定的方法
		Method method = cls.getDeclaredMethod("setAge", int.class); // 第一个参数是方法名，第二个是方法的参数类型
		System.out.println("method :" + method);
		
		//执行某方法
		Object obj = cls.newInstance();
		method.invoke(obj, 30);//第一个参数是实例化后的对象，第二个参数是传入方法的参数
		System.out.println(obj.toString());
		
	  }
	}

- 1、getMethods()是获取本类以及父类或者父接口中所有的公共方法(public修饰符修饰的)，也包含了在根类Object里的方法wait(),equals(),hashCode(),getClass(),notify(),notifyAll()等，因为所有的类都是继承于Object，所以我们编写的类默认都有这些方法。
- 2、getDeclaredMethods()该方法是获取本类中的所有方法，包括私有的(private、protected、默认以及public)的方法。
- 3、获取指定方法的时候，要注意参数对应，如果原方法是void则只需要一个参数即方法名。如果原方法需要参数的话，比如这里的setAge(int age)，所以要加一个参数类型,int.class
- 4、执行方法的时候同样要注意参数对应，这里修改后的输入就变成了`Person [name=nicefish, age=30]`


## 获取成员变量/字段 Field

    package com.fish.test;

	import java.lang.reflect.Field;

	public class getField {
	public static void main(String[] args) throws ClassNotFoundException, NoSuchFieldException, SecurityException, IllegalArgumentException, IllegalAccessException {
		
		Class<?> cls = Class.forName("com.fish.test.Person");
		
		//获取成员变量/字段
		  //获取指定名字的Field
		Field field1 = cls.getDeclaredField("name");
		Field field2 = cls.getDeclaredField("age");
		System.out.println("Field :" + field1.getName());
		System.out.println("Field :" + field2.getName());
		//输出：Field :name
				Field :age
		
		
		  //获取字段的数组，私有也可以获取
		Field []fields = cls.getDeclaredFields();
		for(Field field : fields) {
			System.out.println(field.getName() + ", ");
		}
		//输出：name, 
				age, 
		
		//获取指定对象的Field值
		Person person = new Person("方木", 30);
			//name字段是private，所以在传参更改值的时候要先使用setAccessible函数
		    //取消了Java的权限控制检查（注意不是改变方法或字段的访问权限）,修改了其private成员变量的值。
		field1.setAccessible(true);
		Object obj1 = field1.get(person);
		System.out.println("person对象的字段name的值是:" + obj1);
		//输出：	person对象的字段name的值是:方木



		//设置指定对象的Field值
		field2.setAccessible(true);
		field2.set(person, 45);
		System.out.println("设置person对象的字段age的值为:" + person.getAge());
		//输出：设置person对象的字段age的值为:45
	}
	}



- 而关于setAccessible()方法是否会破坏类的访问规则，产生安全隐患，参考以下回答
![](/images/legacy/java-reflection/003-33c317cfcc.png)


## 获取父类定义的信息

定义一个父类

    package com.fish.test;

	public class Father {
	public Father() {
		
	}
	private String method1() {
		return "this is father's private method";
	}
	}

定义一个子类

    package com.fish.test;

	public class Son extends Father{
	public Son() {
		
	}
	
	private void method2(int age) {
		System.out.println("Son's age is :" + age);
	}
	}

获取父类中定义的方法

    package com.fish.test;

	import java.lang.reflect.InvocationTargetException;
	import java.lang.reflect.Method;

	public class getSuperClass {
	public static void main(String[] args) throws ClassNotFoundException, NoSuchMethodException, SecurityException, InstantiationException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {
		Class cls = Class.forName("com.fish.test.Son");
		
		//获取父类的Class
		Class superClass = cls.getSuperclass();
		System.out.println(superClass);
		
		Method m1 = superClass.getDeclaredMethod("method1");
		Object obj = superClass.newInstance();
		//method1是私有方法，同样的处理
		m1.setAccessible(true);
		System.out.println(m1.invoke(obj));

		//输出：class com.fish.test.Father
				this is father's private method
			
	}
	}

# 优缺点
- 优点：程序更加灵活，且方便拓展，能够在程序运行时动态的获取类的实例
- 缺点：性能较低，且需要注意安全问题，另外还破坏了类的封装性 

# 参考来源
[https://www.cnblogs.com/jiaqingshareing/p/6024541.html](https://www.cnblogs.com/jiaqingshareing/p/6024541.html)

[http://www.cnblogs.com/gulvzhe/archive/2012/01/27/2330001.html](http://www.cnblogs.com/gulvzhe/archive/2012/01/27/2330001.html)

[http://www.cnblogs.com/keis/archive/2011/03/29/1998736.html](http://www.cnblogs.com/keis/archive/2011/03/29/1998736.html)
