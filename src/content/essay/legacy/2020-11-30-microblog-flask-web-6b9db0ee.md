---
title: "MicroBlog——flask-web学习(一)"
date: 2020-11-30
draft: false
archive: true
slug: 2020-11-30-microblog-flask-web-6b9db0ee
badge: 旧文
tags:
  - "Python"
---
## 前言
学习用Python和Flask来创建Web应用MicroBlog  
学习资料[The Flask Mega-Tutorial教程](https://github.com/luhuisicnu/The-Flask-Mega-Tutorial-zh)

## 第一章 入门

### 1、venv
为了解决维护不同应用程序对应不同版本的问题，Python使用了虚拟环境的概念。虚拟环境是Python解释器的完整副本。在虚拟环境中安装三方包时只会作用到虚拟环境，全局Python解释器不受影响。  
那么，就为每个应用程序安装各自的虚拟环境。虚拟环境还有一个好处，即它们由创建它们的用户所拥有，所以不需要管理员帐户。  
但是配置时出现出错。


```
$ python3 -m venv venv
Error: [WinError 2] The system cannot find the file specified
```

![image.png](/images/legacy/2020-11-30-microblog-flask-web-6b9db0ee/001-355569cef0.png)  
我也是同时安装了python2和3并且为了区别，将python.exe分别重命名添加了2、3的后缀，这就是问题的原因。将python3.exe改回python.exe后执行即可。  


### 2、运行
```
(venv) $ flask run
 * Serving Flask app "microblog.py"
 * Environment: production
   WARNING: This is a development server. Do not use it in a production deployment.
   Use a production WSGI server instead.
 * Debug mode: off
Usage: flask run [OPTIONS]

Error: Could not import "microblog".
```
Flask 允许设置只会在运行flask命令时自动注册生效的环境变量，需要安装 python-dotenv

```
(venv) $ pip install python-dotenv
```

在.flaskenv中添加

```
FLASK_ENV=development
```


## 第二章 模板
编写基础模板base.html，其他html继承模板，让应用程序的所有页面拥有统一外观布局而不用重复编写代码。

## 第三章 Web表单

### 1、配置文件
使用类存储配置变量，以保持良好的组织结构。  
config.py

```
import os

class Config(object):
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
```
> Flask及其一些扩展使用密钥的值作为加密密钥，用于生成签名或令牌。Flask-WTF插件使用它来保护网页表单免受名为Cross-Site Request Forgery或CSRF（发音为“seasurf”）的恶意攻击。顾名思义，密钥应该是隐密的，因为由它产生的令牌和签名的加密强度保证，取决于除了可信维护者之外，没有任何人能够获得它。

### 2、表单模板
本应用引入的第一个Flask插件Flask-WTF，用来处理本应用中的Web表单，它对WTForms进行了浅层次的封装以便和Flask完美结合。


```
生成了一个隐藏字段，其中包含一个用于保护表单免受CSRF攻击的token
{{ form.hidden_tag() }}
```
模板中没有HTML表单元素，这是因为表单的字段对象的在渲染时会自动转化为HTML元素。 我只需在需要字段标签的地方加![image.png](/images/legacy/2020-11-30-microblog-flask-web-6b9db0ee/002-b2ac58c934.png)
需要这个字段的地方加上(size自定义)
![image.png](/images/legacy/2020-11-30-microblog-flask-web-6b9db0ee/003-e5a56fc811.png)

### 3、接收表单数据
当用户在浏览器点击提交按钮后，浏览器会发送POST请求。form.validate_on_submit()就会获取到所有的数据，运行字段各自的验证器，全部通过之后就会返回True，这表示数据有效。  
当form.validate_on_submit()返回True时，登录视图函数调用从Flask导入的两个新函数。 flash()函数是向用户显示消息的有效途径。

### 4、生成链接
直接在模板和源文件中硬编码链接存在隐患。为了更好地管理这些链接，Flask提供了一个名为url_for()的函数，它使用URL到视图函数的内部映射关系来生成URL。 例如，
```
url_for('login')返回/login
url_for('index')返回/index
```
url_for()的参数是endpoint名称，也就是视图函数的名字。

> 为什么使用函数名称而不是URL？  
事实是，URL比起视图函数名称变更的可能性更高。 后面会了解到的第二个原因是，一些URL中包含动态组件，手动生成这些URL需要连接多个元素，枯燥乏味且容易出错。 url_for()生成这种复杂的URL就方便许多。
