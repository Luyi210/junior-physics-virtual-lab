# 实验档案的开源设计参考

调研日期：2026-11-10。

本轮围绕“学生保存结构化实验记录、断网后可靠同步、教师按权限查看”学习现有开源设计。借鉴的是数据组织和交互原则；本轮没有复制第三方源码，也没有引入完整 LMS（教学管理系统）或 LRS（学习记录存储系统）。

## 1. Moodle 与 Moodle App

| 官方来源 | 许可证或用途 |
| --- | --- |
| [Moodle 仓库](https://github.com/moodle/moodle) | GPL-3.0；教学任务、学生提交和教师反馈的参考 |
| [Moodle App 仓库](https://github.com/moodlehq/moodleapp) | Apache-2.0；与 Moodle 主仓库的许可证不同 |
| [学生提交与教师反馈](https://docs.moodle.org/503/en/Using_Assignment) | 保存作业、重新提交、查看学生多次尝试 |
| [App 开发指南](https://moodledev.io/general/app/development/development-guide) | 将离线数据存取与联网同步分成独立服务 |
| [Access API](https://moodledev.io/docs/5.3/apis/subsystems/access) | 结合角色与课程、活动等上下文判断权限 |
| [官方版本记录](https://moodledev.io/general/releases/) | 项目持续发布；实际采用依赖前应重新核对维护与支持状态 |

对本项目的启发：

- **本地保存与联网同步分离。** 页面先保存学生输入；同步模块负责上传、重试和状态更新，网络错误不应导致已经保存的内容丢失。
- **显示真实保存状态。** “已保存在本机”与“已同步到服务器”应有区别，不能在上传失败时显示同步成功。
- **角色之外还要校验数据范围。** 学生只能访问自己的记录；教师还需通过所属班级、任务关系校验，不能只判断其角色是教师。
- **保留原始证据。** 实验记录和后续教师反馈各自有明确归属，便于以后支持多次尝试与修改历史。

这些是针对本平台的设计取舍，不是对 Moodle 默认权限的复刻。尤其不能默认让所有教师查看所有班级。当前 React 与 Node.js 架构也无需替换为 Moodle 的 PHP 系统或 App 技术栈。

## 2. xAPI 规范与 Learning Locker

| 官方来源 | 许可证或用途 |
| --- | --- |
| [ADL xAPI 规范仓库](https://github.com/adlnet/xAPI-Spec) | 所查规范文件采用 Apache-2.0 |
| [xAPI 通信规范](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Communication.md) | Statement ID、重复请求、冲突与并发处理 |
| [Learning Locker xapi-service](https://github.com/LearningLocker/xapi-service) | MIT；学习记录接口的独立服务 |
| [Learning Locker 主仓库](https://github.com/LearningLocker/learninglocker) | GPL-3.0；与 xapi-service 的许可证不同 |
| [官方组织及维护状态](https://github.com/learninglocker) | 调研时 xapi-service 有近期更新；主仓库更新较旧，旧 docs 仓库已归档 |
| [官方架构说明](https://learninglocker.atlassian.net/wiki/spaces/DOCS/pages/688132/Architecture+Overview) | 区分记录接口、应用界面及后台任务 |

对本项目的启发：

- **一次修改使用固定的 `mutationId`。** 网络超时后重发同一次修改时保留原 ID，不能每次重试都生成新 ID。
- **区分记录与修改。** `recordId` 标识一份实验档案，`mutationId` 标识一次保存操作。学生再次修改档案时产生新的操作 ID；重试仍沿用该次操作 ID。
- **重复请求不重复写入。** 同操作 ID、同内容的请求应得到可确认的结果；同操作 ID 携带不同内容应返回明确冲突，不能静默覆盖。
- **并发修改显式处理。** 旧版本保存不得悄悄覆盖新版本；遇到冲突时保留本地内容并告知用户，由后续处理决定如何合并。
- **时间与身份由各自可信来源负责。** 区分学生操作时间与服务器接收时间；服务端根据登录会话确定归属，不接受客户端任意指定学生身份。

上述 `recordId`／`mutationId` 设计是本项目从可靠重试原则推导出的方案，不等同于 xAPI 的 Statement 数据结构。当前接口不声明完整 xAPI 兼容，也无需为此引入 Learning Locker 的 MongoDB、Redis 或整套部署设施。

## 3. 已有本地学习材料

工作区的 `03_开源参考/` 已包含以下目录，可在后续深入研究时使用：

```text
03_开源参考/
├── 04_Moodle_H5P_教学平台/
├── 05_Open_edX_大型教学平台/
└── 06_xAPI_LearningLocker_学习记录/
```

这些是已有的参考副本，不是主工程运行依赖；本轮未修改它们。本地副本可能落后于官方仓库，复用任何具体源码或依赖前应重新检查相应版本、许可证和维护状态。
