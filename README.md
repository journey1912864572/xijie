# 章节题库网站

这是一个可部署到 GitHub Pages 的静态题库网站。当前超星链接返回登录页，不能在未登录状态下直接抓取课程内容；请在已登录的课程页面运行 `tools/chaoxing-exporter.js`，导出 JSON 后在本网站导入。

## 功能

- 按章节划分题目
- 单选、多选、文本题
- 提交后立即显示正确或错误
- 错题本可反复练习，并显示每题错了几次
- 浏览器本地保存答题记录
- 可配置同步接口，在电脑、手机、平板等设备同步答题记录

## 导入 JSON

```json
[
  {
    "chapter": "第一章",
    "type": "single",
    "prompt": "题干",
    "options": ["A", "B", "C"],
    "answer": ["B"],
    "explanation": "解析"
  }
]
```

## 从超星导出

1. 在浏览器打开课程页并确认已经登录。
2. 打开开发者工具 Console。
3. 打开 `tools/chaoxing-exporter.js`，复制全部脚本到 Console 运行。
4. 浏览器会下载 `chaoxing-question-bank-日期.json`。
5. 回到本网站，点击“导入”选择该 JSON，或把 JSON 内容粘贴到“粘贴导入”区域。

如果导出的题数为 0，说明课程页没有把作业链接暴露在当前页面。请先在超星里展开章节目录，或进入具体作业/章节测验页后再运行脚本。

## 导入 CSV

```csv
chapter,type,prompt,options,answer,explanation
第一章,single,题干,A|B|C,B,解析
第一章,multiple,多选题,A|B|C,A|C,解析
```

## GitHub Pages 发布

1. 在 GitHub 新建仓库。
2. 上传本文件夹内所有文件。
3. 仓库 Settings -> Pages -> Build and deployment 选择 GitHub Actions。
4. 提交后等待 Actions 完成，访问 `https://你的用户名.github.io/仓库名/`。

## 同步接口

网站会向你填写的同步接口发送：

```json
{
  "stats": {},
  "updatedAt": "2026-06-25T00:00:00.000Z"
}
```

接口需要支持 `POST`，并可读取请求头 `X-Sync-Key`。纯静态网页本身不能保存跨设备数据；多端同步必须有你自己的云函数、Supabase Edge Function、Cloudflare Worker 或其他后端接口。
