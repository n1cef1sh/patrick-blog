---
title: "MicroBlog——flask-web学习(二)"
date: 2020-12-03
draft: false
archive: true
slug: 2020-12-03-microblog-flask-web-bb69b9b2
badge: 旧文
tags:
  - "Python"
---
## 第四章 数据库
使用SQLite数据库，中小型应用最方便的选择。
### 1、两个插件
- Flask-SQLAlchemy：  
为流行的SQLAlchemy包做了一层封装以便在Flask中调用更方便，类似SQLAlchemy这样的包叫做Object Relational Mapper，简称ORM。  
ORM允许应用程序使用高级实体（如类，对象和方法）而不是表和SQL来管理数据库。 ORM的工作就是将高级操作转换成数据库命令。

- Flask-Migrate：  
是Alembic的一个Flask封装，是SQLAlchemy的一个数据库迁移框架。

配置两个插件，并在初始化脚本中进行注册。

### 2、数据库模型
新建模块models,创建用户类,并将表的字段定义为类属性，字段则被创建为db.Column类的实例。字段包括id、username、password_hash、email和posts(和Post表的关系)，定义了设置密码和验证密码的两个方法。  
创建Post类，字段包括id、body、timestamp和user_id(外键)。   
__repr__方法用于在调试时打印用户实例。

### 3、数据库迁移
随着应用的不断增长，很可能会新增、修改或删除数据库结构。 Alembic（Flask-Migrate使用的迁移框架）将以一种不需要重新创建数据库的方式进行数据库结构的变更。
首先创建一个数据库迁移存储库(存储迁移脚本)。

```
(venv) $ flask db init
```
会生成名为migrations的新目录。

```
(venv) $ flask db migrate -m "users table"

INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.autogenerate.compare] Detected added table 'user'
INFO  [alembic.autogenerate.compare] Detected added index 'ix_user_email' on '['email']'
INFO  [alembic.autogenerate.compare] Detected added index 'ix_user_username' on '['username']'
  Generating /home/miguel/microblog/migrations/versions/e517276bb1c2_users_table.py ... done
```
由于之前没有数据库，自动迁移将把整个User模型添加到迁移脚本中。

```
(venv) $ flask db upgrade
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> e517276bb1c2, users table
```
flask db migrate命令不会对数据库进行任何更改，只会生成迁移脚本。 要将更改应用到数据库，必须使用flask db upgrade命令。而flask db downgrade命令可以回滚上次的迁移

在这个命令完成之后，会生成一个名为app.db的文件（因为upgrade检测到数据库不存在），即SQLite数据库。

### 4、shell测试
进入Python交互式环境后，导入数据库实例和模型，可以创建用户、动态并且尝试查询操作。  
为了方便在python shell中测试，在入口microblog.py中实现一个函数，它通过添加数据库实例和模型来创建了一个shell上下文环境。


```
from app import app, db
from app.models import User, Post

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Post': Post}
```
执行flask shell，无需再导入就可以使用数据库实例。

```
(venv) E:\PYproject\microblog>flask shell
Python 3.8.6 (tags/v3.8.6:db45529, Sep 23 2020, 15:52:53) [MSC v.1927 64 bit (AMD64)] on win32
App: app [development]
Instance: E:\PYproject\microblog\instance
>>> db
<SQLAlchemy engine=sqlite:///E:\PYproject\microblog\app.db>
>>> User
<class 'app.models.User'>

```


## 第五章 用户登录

### 1、Flask-Login
可以发现flask很多功能都是通过插件来实现的，比如这里的登陆功能也有一个Login插件。该插件管理用户登录状态，以便用户可以登录到应用，然后用户在导航到该应用的其他页面时，应用会“记得”该用户已经登录。它还提供了“记住我”的功能，允许用户在关闭浏览器窗口后再次访问应用时保持登录状态。  
它提供了一个叫做UserMixin的mixin类，包含了四个非常通用的属性或方法。


```
is_authenticated
is_active: 活跃用户的定义是该用户的登录状态是否通过用户名密码登录，通过“记住我”功能保持登录状态的用户是非活跃的
is_anonymous: 常规用户的该属性是False，对特定的匿名用户是True。
get_id()
```
Flask-Login通过在用户会话中存储其唯一标识符来跟踪登录用户。每当已登录的用户导航到新页面时，Flask-Login将从会话中检索用户的ID，然后将该用户实例加载到内存中。  
因此需要配置一个用户加载函数，将字符串类型的参数id传入用户加载函数。

```
@login.user_loader
def load_user(id):
    return User.query.get(int(id))
```

### 2、用户登陆/退出
假设用户已经登录，却导航到应用的*/login* URL，只需要重定向到主页。  
然后使用SQLAlchemy查询对象的filter_by()方法查看用户名。因为道查询用户的结果只可能是有或者没有，所以通过调用first()来完成查询，如果存在则返回用户对象;如果不存在则返回None。   
用户名成功匹配就再验证密码，错误则重试，正确则调用来自Flask-Login的login_ user()函数。 该函数会将用户登录状态注册为已登录，这意味着用户导航到任何未来的页面时，应用都会将用户实例赋值给current_user变量。   
至于退出，Flask-login插件中也有现成的函数logout_user()，编写视图函数退出后重定向到主页index即可。这里要把主页的导航栏做一个调整，用户登陆前或退出后显示的是登陆链接，登陆后显示的是退出链接。  

关于登陆还有一个问题，Flask-Login使用名为@login_required的装饰器来拒绝匿名用户的访问以保护某个视图函数，那么需要实现登录成功之后重定向回到用户之前想要访问的页面。  
当一个没有登录的用户访问被@login_ required装饰器保护的视图函数时，装饰器将重定向到登录页面，不过，它将在这个重定向中包含一些额外的信息以便登录后的回转。 例如，如果用户导航到/index，那么@login_ required装饰器将拦截请求并以重定向到/login来响应，但是它会添加一个查询字符串参数来丰富这个URL，如/login?next=/index。 原始URL设置了next查询字符串参数后，应用就可以在登录后使用它来重定向。

### 3、用户注册
增加注册功能，首先是注册表单的编写。  
用户名不能和数据库已有的重复；密码要设置输入两次，减少输入错误的风险；邮箱的格式也要进行验证。  

```
    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Please use a different username.')

    def validate_email(self, email):
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Please use a different email address.')
```
最后实现用户注册的视图函数。首先确认这个路由的用户没有登陆，表单的处理方式和登陆的一样，然后通过db.session写入数据库，重定向到登陆界面。


```
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(username=form.username.data, email=form.email.data)
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        flash('Congratulations, you are now a registered user!')
        return redirect(url_for('login'))
    return render_template('register.html', title='Register', form=form)
```
