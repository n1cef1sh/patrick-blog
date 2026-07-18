---
title: "简单的C#winForm项目SMS"
date: 2020-11-09
draft: false
archive: true
slug: 2020-11-09-csharp-winform-sms-9fee5375
badge: 旧文
tags:
  - ".NET"
---
### 概述
美其名曰学生管理系统，其实只是个练手的小demo，功能非常残缺……源于学习C#项目连接SQL server时看到的系列视频（BV号BV1zJ411k7cQ）

### 连接数据库Dao.cs
首先还是先学习最开始想要掌握的知识点，项目连接数据库的操作。  
先放上完整代码Dao.cs

```
namespace SMS
{
    class Dao
    {

        public SqlConnection connection()
        {
            string str = "Data Source=LAPTOP-TLNMN63C;Initial Catalog=test;Integrated Security=True";
            SqlConnection sc = new SqlConnection(str);
            sc.Open();//打开数据库连接
            return sc;
        }

        public SqlCommand command(string sql)
        {
            SqlCommand sc = new SqlCommand(sql, connection());
            return sc;
        }

        //用于delete，update和insert,返回受影响的行数
        public int Excute(string sql)
        {
            return command(sql).ExecuteNonQuery();
        }

        //用于select，返回SqlDataReader对象，包含select到的数据
        public SqlDataReader read(string sql)
        {
            return command(sql).ExecuteReader();
        }
    }
}
```
首先是connection()方法连接数据库，本地的SQLserver使用的是windows账户连接，找到用户名和连接参数赋值。创建SqlConection对象，open打开连接。  
command()方法用于将要执行的sql语句传给sc对象。      
excute()方法用于delete,update和insert语句，返回受影响的行数。  
read()方法用于select查询语句，返回SqlDataReader对象，包含了select到的数据。

### 功能
功能上也确实没啥可说的，就是简单的增删改查。有一些零碎的小问题需要注意。

#### 一些小问题
1、name = dataGridView1.SelectedCells[1].Value.ToString();语句会报错“索引超出范围。必须为非负值并小于集合大小”？    
选择那个单元框就是dataGridview1的属性，找到selectionMode，选择FullRowSelect。这样每次可以直接选中一整行，避免出现取值异常。

2、添加数据后自动刷新表单数据？  
添加数据的窗口是form21，学生信息管理窗口是form2,刷新表单数据的函数方法Table()在form2中。  


Form2.cs
```
//添加按钮
        private void toolStripButton1_Click(object sender, EventArgs e)
        {
            Form21 f = new Form21(this);
            f.ShowDialog();
        }
```
Form21.cs
```
 Form2 form2;
 public Form21(Form2 f)
        {
            InitializeComponent();
            button3.Visible = false;//添加时隐藏“修改”按钮

            form2 = f;
        }
```
将form2整个对象作为参数传入form21,在添加和修改的逻辑后增加form2.Table();即可。

（有更好的方法：在后续图书管理系统中再学习记录）

3、DataGridView的属性MultiSelect为false，就可以使得课程只能选择一行，不能选择多行  

DataGridView的属性SelectMode为FullRowSelect就可以使得不是选择一个字段，而是选择一整行  

RowHeaderVisible改为false，取消最左侧的一栏  

4、关于信息修改：  
student类使用 update语句对修改的部分进行更新  
teacher类使用 先删旧后插新的修改方式

5、关于删除功能：  
以删除教师信息为例

```
        private void 删除教师信息ToolStripMenuItem_Click(object sender, EventArgs e)
        {
            
            try
            {
                string tID = dataGridView1.SelectedCells[0].Value.ToString();
                string tName = dataGridView1.SelectedCells[1].Value.ToString();
                DialogResult r = MessageBox.Show("确定要删除'" + tName + "'该教师信息吗？", "提示", MessageBoxButtons.OKCancel);
                if (r == DialogResult.OK)
                {
                    string sql = "delete from Teacher where Id = '" + tID + "' and Name = '" + tName + "'";
                    Dao dao = new Dao();
                    int i = dao.Excute(sql);
                    if (i > 0)
                    {
                        MessageBox.Show("删除成功");
                        
                    }      
                }
                Table();
            }
            catch
            {
                MessageBox.Show("请先选中一行");
            }
        }
```
为了避免未选中时点击删除出现异常，使用try catch弹出提示。并在删除前后都弹出提示。

### 小结
虽然项目非常的基础和简陋，但是还是从头到尾实践了一下C#窗体小项目的完整过程，最重要的是熟悉了一下数据库的交互操作，在其中踩了不少坑，积累了一些小经验，后面继续做一些实践来练习。
