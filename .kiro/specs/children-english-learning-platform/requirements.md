# 需求文档

## 简介

本文档规定了儿童英语学习平台的需求。该平台使儿童能够通过一个交互式系统学习英语词汇，该系统结合了单词翻译、图像关联以及基于艾宾浩斯遗忘曲线的间隔重复复习。系统使用 Google Translate API 进行翻译，并通过基于图像的测验提供游戏化的学习体验。

## 术语表

- **Platform（平台）**: 儿童英语学习 Web 应用程序
- **User（用户）**: 使用平台学习英语词汇的儿童或家长
- **Authentication_System（认证系统）**: 负责用户登录和会话管理的组件
- **Word_Learning_Module（单词学习模块）**: 处理新单词输入、翻译和图像检索的组件
- **Translation_Service（翻译服务）**: Google Translate API 集成组件
- **Image_Service（图像服务）**: 检索与单词相关的图像的组件
- **Database（数据库）**: 用于用户数据、单词和学习进度的持久化存储系统
- **Review_System（复习系统）**: 基于艾宾浩斯遗忘曲线安排和呈现单词复习的组件
- **Quiz_Interface（测验界面）**: 显示带有图像选项的单词复习测验的组件
- **Learning_Record（学习记录）**: 用户学习的单词的存储记录，包括时间戳和复习计划
- **Review_Schedule（复习计划）**: 基于间隔重复计算的单词应该被复习的日期
- **Ebbinghaus_Forgetting_Curve（艾宾浩斯遗忘曲线）**: 基于科学的最佳复习时机模型（通常在初次学习后的 1 天、3 天、7 天、15 天、30 天进行复习）

## 需求

### 需求 1：用户认证

**用户故事：** 作为用户，我想登录平台，以便我可以访问我的个人学习进度和词汇。

#### 验收标准

1. 当用户提交有效凭证时，Authentication_System 应该创建会话并授予对平台的访问权限
2. 当用户提交无效凭证时，Authentication_System 应该返回错误消息并拒绝访问
3. Authentication_System 应该在页面导航之间维护用户会话
4. 当用户登出时，Authentication_System 应该终止会话并重定向到登录页面
5. Authentication_System 应该将所有学习记录与已认证的用户关联

### 需求 2：单词输入和翻译

**用户故事：** 作为用户，我想输入一个英语单词并看到它的中文翻译，以便我可以学习新词汇。

#### 验收标准

1. 当用户提交一个英语单词时，Word_Learning_Module 应该将该单词发送到 Translation_Service
2. 当 Translation_Service 接收到有效单词时，Translation_Service 应该在 5 秒内返回中文翻译
3. 如果 Translation_Service 未能响应，那么 Word_Learning_Module 应该向用户显示错误消息
4. Word_Learning_Module 应该向用户显示英语单词及其中文翻译以供确认
5. 当 Translation_Service 接收到无效或空输入时，Translation_Service 应该返回描述性错误消息

### 需求 3：单词图像检索

**用户故事：** 作为用户，我想看到代表我正在学习的单词的图像，以便我可以通过视觉关联更好地记住单词。

#### 验收标准

1. 当检索到单词翻译时，Image_Service 应该为该单词获取至少一张相关图像
2. Image_Service 应该在请求后 5 秒内返回图像
3. 如果 Image_Service 未能检索到图像，那么 Word_Learning_Module 应该显示默认占位符图像
4. Word_Learning_Module 应该在单词和翻译旁边显示检索到的图像
5. 当用户确认单词和图像时，Word_Learning_Module 应该准备数据以供存储

### 需求 4：单词确认和存储

**用户故事：** 作为用户，我想确认并保存我正在学习的单词，以便我可以稍后复习它们。

#### 验收标准

1. 当用户确认一个单词及其翻译和图像时，Word_Learning_Module 应该将数据发送到 Database
2. Database 应该存储英语单词、中文翻译、图像引用、用户标识符和当前时间戳
3. Database 应该基于 Ebbinghaus_Forgetting_Curve 为新学习的单词创建 Review_Schedule
4. 当 Database 成功存储单词时，Word_Learning_Module 应该向用户显示成功确认
5. 如果 Database 未能存储单词，那么 Word_Learning_Module 应该显示错误消息并允许用户重试

### 需求 5：复习计划计算

**用户故事：** 作为用户，我想让系统自动安排我学过的单词的复习，以便我可以随着时间的推移有效地保留词汇。

#### 验收标准

1. 当单词保存到 Database 时，Review_System 应该基于 Ebbinghaus_Forgetting_Curve 计算复习日期
2. Review_System 应该在初次学习日期后的 1 天、3 天、7 天、15 天和 30 天安排复习
3. Review_System 应该将所有计算出的复习日期存储在与 Learning_Record 关联的 Database 中
4. 当完成复习时，Review_System 应该在 Database 中将该复习日期标记为已完成
5. Review_System 应该在用户完成复习时重新计算下一个复习日期

### 需求 6：复习单词选择

**用户故事：** 作为用户，我想复习到期需要复习的单词，以便我可以在最佳间隔强化我的记忆。

#### 验收标准

1. 当用户访问复习功能时，Review_System 应该查询 Database 以获取复习日期在当前日期或之前的单词
2. Review_System 应该每次复习会话检索至少 1 个单词，最多 20 个单词
3. Review_System 应该优先处理具有最早逾期复习日期的单词
4. 如果没有单词需要复习，那么 Review_System 应该显示一条消息，指示没有可用的复习
5. Review_System 应该将选定的单词发送到 Quiz_Interface 进行呈现

### 需求 7：基于图像的测验呈现

**用户故事：** 作为用户，我想看到一个单词并从多个选项中选择正确的图像，以便我可以以引人入胜的方式测试我的词汇知识。

#### 验收标准

1. 当 Quiz_Interface 接收到要复习的单词时，Quiz_Interface 应该突出显示英语单词
2. Quiz_Interface 应该显示 4 张图像，包括正确的图像和 3 张干扰图像
3. Quiz_Interface 应该在 4 个选项中随机化正确图像的位置
4. Quiz_Interface 应该从用户学习历史中的其他单词检索干扰图像
5. 如果可用的干扰图像少于 3 张，那么 Quiz_Interface 应该从默认图像池中检索额外的图像

### 需求 8：测验答案验证

**用户故事：** 作为用户，我想在选择图像时立即收到反馈，以便我知道我的答案是否正确。

#### 验收标准

1. 当用户选择一张图像时，Quiz_Interface 应该将所选图像与正确图像进行比较
2. 当所选图像正确时，Quiz_Interface 应该显示积极反馈并将复习标记为成功
3. 当所选图像不正确时，Quiz_Interface 应该显示正确答案并将复习标记为不成功
4. Quiz_Interface 应该将复习结果发送到 Review_System 进行记录
5. 当显示反馈时，Quiz_Interface 应该等待 2 秒，然后再继续下一个单词或结束会话

### 需求 9：复习进度跟踪

**用户故事：** 作为用户，我想让系统跟踪我的复习表现，以便准确记录我的学习进度。

#### 验收标准

1. 当用户完成测验问题时，Review_System 应该在 Database 中记录结果和时间戳
2. Database 应该为每次复习尝试存储答案是正确还是不正确
3. 当用户回答正确时，Review_System 应该将 Review_Schedule 更新到下一个间隔
4. 当用户回答不正确时，Review_System 应该在 1 天内安排额外的复习
5. Review_System 应该为每个 Learning_Record 维护所有复习尝试的历史记录

### 需求 10：会话管理和数据持久化

**用户故事：** 作为用户，我想让我的学习数据自动保存，以便如果我关闭浏览器也不会丢失进度。

#### 验收标准

1. Platform 应该在 Database 中持久化所有用户数据、学习记录和复习计划
2. 当用户登录时，Platform 应该从 Database 检索所有关联的学习数据
3. Platform 应该在多个会话之间维护数据一致性
4. 如果数据库操作失败，那么 Platform 应该记录错误并向用户显示适当的消息
5. Database 应该确保每个用户只能访问自己的学习记录

### 需求 11：Google Translate API 集成

**用户故事：** 作为系统管理员，我想让平台与 Google Translate API 集成，以便为用户提供准确的翻译。

#### 验收标准

1. Translation_Service 应该使用有效凭证向 Google Translate API 进行身份验证
2. 当 Translation_Service 发送翻译请求时，Translation_Service 应该将源语言指定为英语，目标语言指定为中文
3. Translation_Service 应该处理 API 速率限制，并在超出限制时返回适当的错误消息
4. Translation_Service 应该解析 API 响应并提取翻译后的文本
5. 如果 Google Translate API 不可用，那么 Translation_Service 应该返回一条错误消息，指示服务暂时不可用

### 需求 12：图像检索服务集成

**用户故事：** 作为用户，我想让平台自动为单词找到合适的图像，以便我有视觉辅助工具来学习。

#### 验收标准

1. 当 Image_Service 接收到一个单词时，Image_Service 应该查询图像源以获取相关图像
2. Image_Service 应该过滤图像以确保它们适合儿童
3. Image_Service 应该返回至少一个可访问且有效的图像 URL
4. Image_Service 应该在 Database 中缓存图像 URL 以减少外部 API 调用
5. 当图像 URL 变为无效时，Image_Service 应该检索新图像并更新 Database

### 需求 13：用户界面响应性

**用户故事：** 作为用户，我想让平台在不同设备上流畅运行，以便我可以在计算机、平板电脑或手机上学习。

#### 验收标准

1. Platform 应该在屏幕宽度从 320 像素到 1920 像素的范围内正确渲染
2. Platform 应该在触摸屏设备上保持可用性
3. Quiz_Interface 应该以适合设备屏幕的大小显示图像
4. Platform 应该在标准宽带连接上在 3 秒内加载主界面
5. 当用户与按钮或图像交互时，Platform 应该在 100 毫秒内提供视觉反馈

### 需求 14：错误处理和用户反馈

**用户故事：** 作为用户，我想在出现问题时收到清晰的消息，以便我了解发生了什么以及接下来该做什么。

#### 验收标准

1. 当发生错误时，Platform 应该以中文显示用户友好的错误消息
2. Platform 应该记录详细的错误信息以供调试
3. Platform 应该在错误消息中区分网络错误、API 错误和数据库错误
4. 当发生可恢复的错误时，Platform 应该向用户提供重试选项
5. Platform 不应该向最终用户显示技术错误详细信息或堆栈跟踪

### 需求 15：数据验证和安全性

**用户故事：** 作为系统管理员，我想让平台验证和清理所有用户输入，以便系统免受恶意数据的侵害。

#### 验收标准

1. 当用户提交单词时，Word_Learning_Module 应该验证输入仅包含字母字符和空格
2. Word_Learning_Module 应该将单词输入限制为最多 50 个字符
3. Authentication_System 应该在将密码存储到 Database 之前对其进行哈希和加盐处理
4. Platform 应该在数据库查询中使用所有用户输入之前对其进行清理，以防止 SQL 注入
5. Platform 应该在处理或存储从外部 API 接收的所有数据之前对其进行验证

