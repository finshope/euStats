# euStats
A tool which can show GTNH wireless EU statistics in web.

## 使用方法
### 启动web服务器
确保已安装nodejs。
如有必要，修改```server/server.js```第十行的端口号，并修改服务器防火墙白名单。
```
cd server
npm install
node server.js
```
### OC
需修改25行的API地址为实际地址。假设服务器ip为**11.22.33.44**, web服务器端口为9200，则实际地址为**http://11.22.33.44:9200/api/data**
OC通过适配器连接到电容库，并且不能有其他GT机器。
启动web服务器后再启动OC程序。

### 访问
访问**http://11.22.33.44:9200**即可
