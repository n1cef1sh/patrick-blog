---
title: "MicroBlog——flask-web学习(三)"
date: 2020-12-09
draft: false
archive: true
slug: 2020-12-09-microblog-flask-web-f2f5c8d6
badge: 旧文
tags:
  - "Python"
---
## 第六章 个人主页和头像
### 1、基本步骤
创建新的视图函数，其中@app.route装饰器有些许不同

```
@app.route('/user/<username>')
```
被<和>包裹的URL < username>是动态的。 当一个路由包含动态组件时，Flask将接受该部分URL中的任何文本，并将以实际文本作为参数调用该视图函数。

编写个人主页user.html，添加用户头像，这里使用的服务是Gravatar。

将用户动态的部分单独渲染一个Jinja2子模板，将其命名为app/templates/_post.html， _前缀只是一个命名约定，可以帮助识别哪些模板文件是子模板。在user.html中使用include引用该子模板。  
![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/001-54b6d09080.png)  


### 2、记录最后访问时间
一旦某个用户向服务器发送请求，就将当前时间写入到这个字段。为了实现这个需求，在视图函数处理请求之前执行一段简单的代码逻辑。  
Flask中的@before_ request装饰器注册在视图函数之前执行的函数。可以在一处地方编写代码，并让它在任何视图函数之前被执行。因此简单地实现了检查current_ user是否已经登录，并在已登录的情况下将last_seen字段设置为当前时间。
![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/002-43b8902e62.png)

### 3、资料编辑
提供新的功能，让用户可以对自己的昵称和自我介绍进行编辑。  
编写新的表单和渲染模板，使用视图函数将他们结合起来。


```
from app.forms import EditProfileForm

@app.route('/edit_profile', methods=['GET', 'POST'])
@login_required
def edit_profile():
    form = EditProfileForm()
    if form.validate_on_submit():
        current_user.username = form.username.data
        current_user.about_me = form.about_me.data
        db.session.commit()
        flash('Your changes have been saved.')
        return redirect(url_for('edit_profile'))
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.about_me.data = current_user.about_me
    return render_template('edit_profile.html', title='Edit Profile',
                           form=form)
```


如果validate_ on _ submit()返回True，将表单中的数据复制到用户对象中，然后将对象写入数据库。  
但是当validate_ on_submit()返回False时，可能是由于两个不同的原因。
- 可能是因为浏览器刚刚发送了一个GET请求，需要通过提供表单模板的初始版本来响应。
- 也可能浏览器发送带有表单数据的POST请求，但该数据中的某些内容无效。  

当第一次请求表单时，用存储在数据库中的数据预填充字段，将存储在用户字段中的数据移动到表单中，这将确保这些表单字段具有用户的当前数据。但在验证错误的情况下，不写任何表单字段，因为它们已经由WTForms填充了。为了区分这两种情况，需要检查request.method，如果它是GET，这是初始请求的情况，如果是POST则是提交表单验证失败的情况。


### 第七章 错误处理机制
在上一章完成的工作里，留下了一个错误的地方。在个人资料编辑的时候，如果尝试将用户名改为另一个已存在的用户名，则会出现“Internal Server Error”页面。

### 1、调试模式

启用调试模式，它是Flask在浏览器上直接运行一个友好调试器的模式。

```
(venv) $ set FLASK_DEBUG=1
```
再次崩溃时，在浏览器中就可查看交互式调试器。

> 永远不要在生产服务器上以调试模式运行Flask应用  
永远不要在生产服务器上以调试模式运行Flask应用  
永远不要在生产服务器上以调试模式运行Flask应用

调试器允许用户远程执行服务器中的代码，因此对于想要渗入应用或服务器的恶意用户来说，这可能是开门揖盗。 作为附加的安全措施，运行在浏览器中的调试器开始被锁定，并且在第一次使用时会要求输入一个PIN码（可以在flask run命令的输出中看到它）。

### 2、自定义错误页面
使用@errorhandler装饰器来声明一个自定义的错误处理器。


```
from flask import render_template
from app import app, db

@app.errorhandler(404)
def not_found_error(error):
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return render_template('500.html'), 500
```
500错误的错误处理程序应当在引发数据库错误后调用，而上面的用户名重复实际上就是这种情况。 为了确保任何失败的数据库会话不会干扰模板触发的其他数据库访问，执行会话回滚来将会话重置为干净的状态。

为了让这些错误处理程序在Flask中注册，需要在应用实例创建后导入新的app/errors.py模块，也就是在app/_ init_.py中添加

```
from app import routes, models, errors
```

### 3、记录日志
存储路径位于顶级目录下，相对路径为logs/microblog.log。启用另一个基于文件类型RotatingFileHandler的日志记录器，它可以切割和清理日志文件，以确保日志文件在应用运行很长时间时不会变得太大。

服务器每次启动时都会在日志中写入一行。 当此应用在生产服务器上运行时，这些日志数据将告诉你服务器何时重新启动过。

为了使日志记录更有用，将应用和文件日志记录器的日志记录级别降低到INFO级别。  
按照严重程度递增的顺序，分别是DEBUG、INFO、WARNING、ERROR和CRITICAL。

![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/003-d4c42d6e3d.png)

### 4、修复错误
至于最开始的用户名重复的问题，只需要编辑资料时，增加一个验证方法，如果在表单中输入的用户名与原始用户名相同，那么就没有必要检查数据库是否有重复了，如果和其他的重复，就提示重新输入。


## 第八章 粉丝
因为是博客系统，必须要有最基础的社交功能，也就是关注/被关注。关于粉丝主要通过扩展数据库来实现。

### 1、数据库模型
用户和被关注用户之间的关系是多对多，但是两个实体都是用户。 一个类的实例被关联到同一个类的其他实例的关系被称为**自引用关系**。

![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/004-4b0512fd70.png)

在models.py里添加followers关联表。因为这是一个除了外键没有其他数据的辅助表，所以创建它的时候没有关联到模型类

```
followers = db.Table('followers',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'))
)
```

然后在用户表中声明多对多的关系

```
    followed = db.relationship(
        'User', secondary=followers,
        primaryjoin=(followers.c.follower_id == id),
        secondaryjoin=(followers.c.followed_id == id),
        backref=db.backref('followers', lazy='dynamic'), lazy='dynamic')
```
这些参数不太好理解。
- primaryjoin 指明了通过关系表关联到左侧实体（关注者）的条件 。关系中的左侧的join条件是关系表中的follower_ id字段与这个关注者的用户ID匹配。followers.c.follower_ id表达式引用了该关系表中的follower_id列。
- secondaryjoin 指明了通过关系表关联到右侧实体（被关注者）的条件 。 这个条件与primaryjoin类似，唯一的区别在于，使用关系表的字段的是followed_id了。
- backref定义了右侧实体如何访问该关系。在左侧，关系被命名为followed，所以在右侧使用followers来表示所有左侧用户的列表，即粉丝列表。附加的lazy参数表示这个查询的执行模式，设置为动态模式的查询不会立即执行，直到被调用。
- lazy和backref中的lazy类似，只不过当前的这个是应用于左侧实体，backref中的是应用于右侧实体。


### 2、查看关注用户的动态
定义想要得到的信息来执行一个数据库查询，然后让数据库找出如何以最有效的方式来提取这些信息。

这里主要学习一下数据库的查询语句。

#### join联合查询

![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/005-4847305934.png)
```
Post.query.join(followers, (followers.c.followed_id == Post.user_id))
```
![image.png](/images/legacy/2020-12-09-microblog-flask-web-f2f5c8d6/006-76457d16cd.png)

user_ id和followed_id列在所有数据行中都是相等的，因为这是join条件。 来自用户john的用户动态不会出现在临时表中，因为被关注列表中没有包含john用户，换句话说，没有任何人关注john。 而来自david的用户动态出现了两次，因为该用户有两个粉丝。

#### filter过滤

```
filter(followers.c.follower_id == self.id)
```
该查询是User类的一个方法，self.id表达式是指感兴趣的用户的ID。filter()挑选临时表中follower_id列等于这个ID的行，换句话说，只保留follower(粉丝)是该用户的数据。

查询是从Post类中发出的，因此结果将是包含在此临时表中的用户动态，而不会存在由于执行join操作添加的其他列。

#### 排序

```
order_by(Post.timestamp.desc())
```
使用用户动态产生的时间戳按降序排列结果列表。排序之后，第一个结果将是最新的用户动态。

#### 完整查询

```
    return Post.query.join(
        followers, (followers.c.followed_id == Post.user_id)).filter(
            followers.c.follower_id == self.id).order_by(
                Post.timestamp.desc())
```

### 3、单元测试
对用户模型的现有方法编写一些单元测试并存储在tests.py模块里，每次更新代码后执行测试。

添加了四个用户模型的测试，包含密码哈希、用户头像和粉丝功能。  通过将应用配置更改为sqlite://，在测试过程中通过SQLAlchemy来使用SQLite内存数据库。 db.create_all()创建所有的数据库表。 这是从头开始创建数据库的快速方法，在测试中相当好用。

### 4、集成
编写模板html和视图函数，将关注/取消关注功能集成。
