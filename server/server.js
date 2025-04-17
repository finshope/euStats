const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());
const port = 9200;

// 托管静态文件
app.use(express.static(path.join(__dirname, "public")));

// 连接SQLite数据库
const db = new sqlite3.Database("./euStats.db", (err) => {
  if (err) {
    console.error("无法连接数据库:", err.message);
  } else {
    console.log("成功连接到SQLite数据库");
    // 创建表
    db.run(
      `CREATE TABLE IF NOT EXISTS eu_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      eu TEXT NOT NULL,
      time DATETIME NOT NULL
    )`,
      (err) => {
        if (err) {
          console.error("创建表失败:", err.message);
        } else {
          console.log("表eu_stats已创建或已存在");
        }
      }
    );
  }
});

function formatTime(time, pattern) {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return pattern
    .replace("yyyy", year)
    .replace("MM", month.toString().padStart(2, "0"))
    .replace("dd", day.toString().padStart(2, "0"))
    .replace("hh", hour.toString().padStart(2, "0"))
    .replace("mm", minute.toString().padStart(2, "0"))
    .replace("ss", second.toString().padStart(2, "0"));
}

// POST /api/data 保存数据到数据库
app.post("/api/data", (req, res) => {
  const data = req.body;
  if (!data) {
    return res.status(200).json({ error: "数据不能为空" });
  }
  if (!Array.isArray(data)) {
    return res.status(200).json({ error: "数据格式不正确" });
  }

  let currentTime = new Date();
  const values = data.map((ele, i) => {
    let cur = new Date(currentTime);
    cur = new Date(
      cur.setSeconds(currentTime.getSeconds() - data.length + 1 + i)
    );

 
    return [ele, formatTime(cur, "yyyy-MM-dd hh:mm:ss")];
  });

  // 分批次插入，每批100条以避免SQLite参数限制
  const batchSize = 100;
  let processed = 0;

  const insertBatch = (batch, callback) => {
    const placeholders = batch.map(() => "(?, ?)").join(", ");
    const sql = `INSERT INTO eu_stats (eu, time) VALUES ${placeholders}`;
    const flattened = batch.flat();

    db.run(sql, flattened, function (err) {
      if (err) {
        return callback(err);
      }
      callback(null);
    });
  };

  const processNextBatch = () => {
    if (processed >= values.length) {
      return res.json({ message: "保存数据成功" });
    }

    const batch = values.slice(processed, processed + batchSize);
    processed += batchSize;

    insertBatch(batch, (err) => {
      if (err) {
        console.error("保存数据失败:", err);
        return res.status(500).json({ error: "保存数据失败" });
      }
      processNextBatch();
    });
  };

  // 开始处理第一个批次
  processNextBatch();
});

// 原有API保持不变（从文件读取）
app.get("/api/data", (req, res) => {
  let seconds = req.query.q || 3600;
  // read from db
  db.all(
    `SELECT eu, time FROM eu_stats ORDER BY time DESC LIMIT ${seconds}`,
    (err, rows) => {
      if (err) {
        console.error("查询数据失败:", err);
        return res.status(500).json({ error: "查询数据失败" });
      }

      const result = rows.map((row) => row);
      res.json(result.reverse());
    }
  );

  // fs.readFile(path.join(__dirname, 'wirelesseu.txt'), 'utf8', (err, data) => {
  //   if (err) return res.status(500).json({ error: '读取文件失败' });

  //   const result = data
  //     .trim()
  //     .split('\n')
  //     .map(line => {
  //       const [value] = line.split(' ');
  //       return value;
  //     });

  //   res.json(result.slice(result.length - seconds));
  // });
});

app.listen(port, () => {
  console.log(`服务运行在 http://localhost:${port}`);
});
