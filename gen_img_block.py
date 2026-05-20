import requests
import hashlib
import hmac
import os
import uuid
import time
import datetime
import urllib.parse

class GeekaiUploader:
    def __init__(self, cookie: str):
        self.base_url = "https://geekai.co"
        self.session = requests.Session()
        # 完全模拟浏览器请求头
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Referer": f"{self.base_url}/chat",
            "Origin": self.base_url,
            "X-Requested-With": "XMLHttpRequest",
            "Cookie": cookie
        })

    def compute_file_md5(self, file_path: str) -> str:
        """分块计算文件MD5，支持大文件"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()

    def check_block_cache(self, md5: str) -> dict | None:
        """检查文件是否已上传（秒传接口）"""
        url = f"{self.base_url}/api/block/{md5}"
        try:
            resp = self.session.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("data"):
                    print(f"✅ 命中缓存！直接复用block: {md5}")
                    return data["data"]
            elif resp.status_code == 404:
                print(f"ℹ️ 未命中缓存，需要上传新文件: {md5}")
            else:
                print(f"⚠️ 缓存接口异常，状态码: {resp.status_code}")
        except Exception as e:
            print(f"⚠️ 缓存接口请求失败: {str(e)}")
        return None

    def get_cos_credential(self) -> dict:
        """获取COS上传凭证"""
        url = f"{self.base_url}/api/cos/credential"
        resp = self.session.get(url)
        resp.raise_for_status()
        return resp.json()

    def generate_cos_signature(self, credential: dict, method: str, pathname: str, headers: dict) -> str:
        """生成腾讯云COS签名"""
        secret_id = credential["secret_id"]
        secret_key = credential["secret_key"]
        
        # 计算时间戳（参考JS代码：当前时间-1秒作为开始，有效期15分钟）
        current_time = int(time.time()) - 1  # 与JS保持一致：减去系统偏移再减1
        start_time = current_time
        end_time = current_time + 900   # 有效期15分钟
        
        q_sign_time = f"{start_time};{end_time}"
        q_key_time = f"{start_time};{end_time}"
        
        # 处理headers，只保留需要签名的headers（参考JS代码中的P数组）
        # 必须包含的headers: cache-control, content-disposition, content-encoding, 
        # content-length, content-md5, expect, expires, host, if-match, 
        # if-modified-since, if-none-match, if-unmodified-since, origin, range, 
        # transfer-encoding 以及所有 x-cos-* headers
        signed_headers = {}
        required_headers = [
            "cache-control", "content-disposition", "content-encoding",
            "content-length", "content-md5", "expect", "expires", "host",
            "if-match", "if-modified-since", "if-none-match", 
            "if-unmodified-since", "origin", "range", "transfer-encoding"
        ]
        for key, value in headers.items():
            lower_key = key.lower()
            if lower_key in required_headers or lower_key.startswith("x-cos-"):
                signed_headers[lower_key] = str(value)
        
        # 按字典序排序并拼接（JS: tt.obj2str）
        q_header_list = ";".join(sorted(signed_headers.keys()))
        # 注意：值需要URL编码
        q_header_str = "&".join([f"{k}={urllib.parse.quote(str(v), safe='')}" for k, v in sorted(signed_headers.items())])
        
        # URL参数列表（这里没有参数）
        q_url_param_list = ""
        q_url_param_str = ""
        
        # 构造待签名字符串（注意使用换行符连接）
        http_string = f"{method.lower()}\n{pathname}\n{q_url_param_str}\n{q_header_str}\n"
        
        # 计算签名密钥（注意：secret_key直接作为字符串使用，不需要base64解码）
        sign_key = hmac.new(secret_key.encode('utf-8'), q_key_time.encode('utf-8'), hashlib.sha1).hexdigest()
        
        # 计算字符串摘要
        http_string_hash = hashlib.sha1(http_string.encode('utf-8')).hexdigest()
        
        # 构造签名原文（注意使用换行符连接）
        string_to_sign = f"sha1\n{q_sign_time}\n{http_string_hash}\n"
        
        # 计算最终签名
        signature = hmac.new(sign_key.encode('utf-8'), string_to_sign.encode('utf-8'), hashlib.sha1).hexdigest()
        
        # 构造Authorization
        auth = (
            f"q-sign-algorithm=sha1"
            f"&q-ak={secret_id}"
            f"&q-sign-time={q_sign_time}"
            f"&q-key-time={q_key_time}"
            f"&q-header-list={q_header_list}"
            f"&q-url-param-list={q_url_param_list}"
            f"&q-signature={signature}"
        )
        
        return auth

    def upload_to_cos(self, file_path: str, credential: dict) -> str:
        """上传文件到腾讯云COS"""
        file_ext = os.path.splitext(file_path)[1].lstrip('.').lower()  # 强制小写
        if file_ext not in ["png", "jpg", "jpeg", "webp"]:
            file_ext = "png"

        # 按网站格式生成COS路径
        now = datetime.datetime.now()
        cos_key = f"image/{now.year}/{now.month:02d}/{now.day:02d}/{uuid.uuid4().hex}.{file_ext}"
        cos_url = f"https://geekai-1317767639.cos.ap-shanghai.myqcloud.com/{cos_key}"
        pathname = f"/{cos_key}"

        with open(file_path, "rb") as f:
            file_data = f.read()
        
        file_size = len(file_data)
        
        # 构建headers
        cos_headers = {
            "Content-Type": f"image/{file_ext.lower()}",
            "Content-Length": str(file_size),
            "Host": "geekai-1317767639.cos.ap-shanghai.myqcloud.com",
            "x-cos-security-token": credential["token"]
        }

        # 生成签名
        auth = self.generate_cos_signature(credential, "PUT", pathname, cos_headers)
        cos_headers["Authorization"] = auth

        resp = self.session.put(cos_url, data=file_data, headers=cos_headers)
        if resp.status_code != 200:
            raise Exception(f"COS上传失败，状态码：{resp.status_code}, 响应：{resp.text}")
        return f"https://static.geekai.co/{cos_key}"

    def create_block_record(self, file_path: str, file_url: str, md5: str) -> dict:
        """创建block记录"""
        file_name = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        payload = {
            "md5": md5,
            "name": file_name,
            "type": f"image/{os.path.splitext(file_path)[1].lstrip('.').lower()}",
            "size": file_size,
            "url": file_url,
            "channel": "dati"
        }

        url = f"{self.base_url}/api/block"
        resp = self.session.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()["data"]

    def upload_image(self, file_path: str) -> dict:
        """主方法：传入图片路径，返回可用的block数据"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        print(f"[1/5] 计算文件MD5: {file_path}")
        md5 = self.compute_file_md5(file_path)

        print(f"[2/5] 检查缓存是否命中: {md5}")
        cached_block = self.check_block_cache(md5)
        if cached_block:
            return cached_block

        print(f"[3/5] 获取COS上传凭证")
        credential = self.get_cos_credential()

        print(f"[4/5] 上传文件到腾讯云COS")
        file_url = self.upload_to_cos(file_path, credential)

        print(f"[5/5] 创建block记录")
        block_data = self.create_block_record(file_path, file_url, md5)

        print(f"✅ 上传完成！block uuid: {block_data['uuid']}")
        return block_data

# ====================== 使用示例 ======================
def main(args):
    # 替换为你的Cookie
    YOUR_COOKIE = args["cookie_str"]
    uploader = GeekaiUploader(YOUR_COOKIE)

    # 替换为你的图片路径
    block = uploader.upload_image(args["图片路径"])
    print("最终block数据：", block)

    args["block"] = block