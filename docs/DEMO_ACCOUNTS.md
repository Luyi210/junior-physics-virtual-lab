# 本地演示账号清单

以下账号由后台 API 写入 SQLite，可通过真实登录接口认证。它们仅用于本机产品演示，不应直接用于正式学校环境。

## 教师与管理员

| 身份 | 姓名 | 登录邮箱 | 密码 |
| --- | --- | --- | --- |
| 教师 | 李老师 | `teacher@physics.local` | `Teacher123!` |
| 管理员 | 学校管理员 | `admin@physics.local` | `Admin123!` |

管理员登录后可创建、停用和重置教师或学生账号；教师登录后只能管理学生，不能创建或操作其他教师账号。

## 八年级（1）班学生

十名学生已加入后台班级“八年级（1）班”，统一临时密码为 `Student123!`。

| 序号 | 姓名 | 登录邮箱 | 临时密码 |
| --- | --- | --- | --- |
| 01 | 陈一诺 | `student01@physics.local` | `Student123!` |
| 02 | 王子墨 | `student02@physics.local` | `Student123!` |
| 03 | 林书言 | `student03@physics.local` | `Student123!` |
| 04 | 周予安 | `student04@physics.local` | `Student123!` |
| 05 | 许星遥 | `student05@physics.local` | `Student123!` |
| 06 | 宋知远 | `student06@physics.local` | `Student123!` |
| 07 | 江雨桐 | `student07@physics.local` | `Student123!` |
| 08 | 沈嘉树 | `student08@physics.local` | `Student123!` |
| 09 | 叶可欣 | `student09@physics.local` | `Student123!` |
| 10 | 顾言川 | `student10@physics.local` | `Student123!` |

## 使用边界

- 密码在数据库中使用 scrypt 散列保存，不保存明文；本文档中的明文只为了本地演示交接。
- 正式部署前应删除演示账号，改用邀请或批量导入方式创建真实师生账号。
- 正式账号应使用随机初始密码、首次登录强制改密、密码重置和登录审计。
- 当前访问令牌有效期为 8 小时；生产环境还需增加刷新令牌和令牌撤销机制。
