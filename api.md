极客智坊API手册

文生视频
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}' \
--data '{
    "model":"cogvideox-flash",
    "prompt":"小猫小狗在草丛中打闹",
    "async": false
}'

异步任务
async 参数用于控制是否异步生成视频，默认为 false，表示创建视频接口会同步等待视频生成完毕并返回。如果设置为 true，则会异步生成视频并返回任务ID，你可以使用该任务ID轮询视频生成状态：
curl --location --request GET 'https://geekai.co/api/v1/videos/{task_id}' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}'
直到任务状态值为 succeed，并拿到视频生成结果 URL。对于视频生成任务，一般比较耗时，推荐使用异步生成视频模式。

图生视频
单张图片
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}' \
--data '{
    "model":"kling-v1-6",
    "prompt":"让富春山居图动起来",
    "image":"https://static.geekai.co/image/2025/04/02/79b4256e75137022ddd80f3fc21b5d35.png",
    "async": true
}'
图生视频耗时比文生视频更长，建议通过异步方式生成，即将 async 参数设置为 true，然后将响应中获取到的 task_id 字段值填充到下面的查询接口 URL 来轮询视频生成状态，直到任务状态为 succeed，并获取到视频生成结果 URL：
curl --location --request GET 'https://geekai.co/api/v1/video/{task_id}/result' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}'

首尾帧
有些视频模型支持首尾帧的功能，你可以通过在请求参数传入首尾帧图片链接来实现基于该图片生成视频的功能：
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}' \
--data '{
    "model":"veo-2.0-generate-001",
    "prompt":"根据下面的首尾帧图片生成一段大黄蜂从汽车变成机器人的视频",
    "image":"https://static.geekai.co/storage/2025/07/04/ec7eae8d6f4540a6b02b027ff8bc7a70.jpeg",
    "image_tail":"https://static.geekai.co/storage/2025/07/04/20250704145107.jpg",
    "async": true
}'

多张图片
如果你希望通过传入更多图片来生成视频，可以通过传递图片链接列表到视频生成接口的 image 参数来实现：
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {YOUR_GEEKAI_API_KEY}' \
--data '{
    "model":"veo-2.0-generate-001",
    "prompt":"生成一段让图片1中的猫抓图片2中的蝴蝶的视频",
    "image":["https://static.geekai.co/image/2025/07/02/2d915923d2904e1e816c684d99abdc17.jpg","https://static.geekai.co/image/2025/07/03/9c020196e343992413ffe120bf120438.png"],
    "async": true
}'

Veo 3.1 & Veo 3.1 Fast & Veo 3.1 Lite模型参数介绍
模型ID：veo-3.1-generate-preview/veo-3.1-fast-generate-preview/veo-3.1-lite-generate-preview
Veo 3.1 支持的 aspect_ratio 宽高比如下：
16:9：横屏（默认值）
9:16：竖屏
Veo 3.1 支持的 resolution 分辨率如下：
720p：标清（默认值）
1080p：高清
4k：超清（Veo 3.1 Lite 不支持该分辨率）
Veo 3.1 官方线路支持的 duration 视频时长如下：
4 秒（默认值）
6 秒
8 秒

文生视频 部分传参举例 
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $GEEKAI_API_KEY' \
--data '{
    "prompt": "生成一段小猫在火星散步的视频",
    "model": "veo-3.1-fast-generate-preview",
    "async": true
}'
查询生成状态
通过异步响应中的任务 ID（task_id）可查询视频生成状态：
curl --location --request GET 'https://geekai.co/api/v1/videos/fbdf2778-3d6e-4760-b256-bbfe1ebfe3d1' \
--header 'Authorization: Bearer $GEEKAI_API_KEY'
如果视频还在生成中，响应结果如下：
{
    "model": "veo-3.1-fast-generate-preview",
    "task_id": "fbdf2778-3d6e-4760-b256-bbfe1ebfe3d1",
    "task_status": "running"
}
当视频生成完成后，响应结果如下：
{
    "model": "veo-3.1-fast-generate-preview",
    "task_id": "fbdf2778-3d6e-4760-b256-bbfe1ebfe3d1",
    "task_status": "succeed",
    "video_result": [
        {
            "url": "https://static.geekai.co/video/2025/11/28/a272281368ad541d1fbcaf77e2b103b6.mp4"
        }
    ]
}
通过 video_result 中的 URL 即可获取生成的视频，该视频链接默认有效期为 7 天，请及时下载保存。
基于首尾帧生成视频
你可以通过 image 参数指定视频的首帧图像，通过 image_tail 参数指定视频的尾帧图像，模型会根据这两张图像生成一段过渡视频：
curl --location 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $GEEKAI_API_KEY' \
--data '{
    "prompt": "根据下面的首尾帧图片生成一段大黄蜂从汽车变成机器人的视频",
    "image": "https://static.geekai.co/storage/2025/07/04/ec7eae8d6f4540a6b02b027ff8bc7a70.jpeg",
    "image_tail": "https://static.geekai.co/storage/2025/07/04/20250704145107.jpg",
    "model": "veo-3.1-fast-generate-preview",
    "async": true
}'
如果仅传递 image 参数而不传递 image_tail 参数，则表示仅使用首帧生成视频。
获取视频生成结果的方式与前面介绍的文生视频相同，不再赘述。
基于多张参考图生成视频
Veo 3.1 现在最多支持使用 3 张参考图片来引导生成视频的内容。您可以提供人物、角色或产品的图片，以确保生成视频中主体的外观得以保留。
curl --location --request POST 'https://geekai.co/api/v1/videos/generations' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $GEEKAI_API_KEY' \
--data '{
    "model": "veo-3.1-fast-generate-preview",
    "prompt": "[图1]戴着眼镜穿着蓝色T恤的男生和[图2]的柯基小狗，坐在[图3]的草坪上，3D卡通风格",
    "images": [
        "https://ark-project.tos-cn-beijing.volces.com/doc_image/seelite_ref_1.png",
        "https://ark-project.tos-cn-beijing.volces.com/doc_image/seelite_ref_2.png",
        "https://ark-project.tos-cn-beijing.volces.com/doc_image/seelite_ref_3.png"
    ],
    "async": true
}'