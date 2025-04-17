local os = require("os")
local component = require("component")
local utils = require("utils")

local gt_machine = component.gt_machine


-- 保存最近10分钟的历史数据，每个元素为 {counter = 采样计数, eu = 数字}
local history = {}

-- 内部采样计数器，每秒递增
local counter = 0

-- 记录打印行数，超过60行时清屏
local printed_lines = 0

-- 用于缓冲文件写入的数据，每秒采样一次，将数据缓冲，每60秒写入一次
local data_buffer = {}

-- 统一使用科学计数法格式化数字的函数
local function formatNumber(num)
    return string.format("%.5e", num)
end

local API_URL="http://11.22.33.44:9200/api/data" --需修改为实际的API地址，一般为服务器地址
local function post_data(data)
    return utils.post(API_URL, data)
end

while true do
    counter = counter + 1
    local info = gt_machine.getSensorInformation()
    local current_time_str = os.date("%Y-%m-%d %H:%M:%S") -- 显示时间，不参与 dt 计算
    
    if info and info[23] then
        -- 从 info[23] 中提取由数字和逗号组成的子串
        local extracted = info[23]:match("([%d,]+)")
        if extracted then
            -- 去掉逗号得到纯数字字符串，并转换为数值
            local numStr = extracted:gsub(",", "")
            local eu = tonumber(numStr)
            if eu then
                local eu_scientific = formatNumber(eu)
                -- 缓存写入文件的数据：当前时间、原始数字字符串及科学计数法表示
                local line = numStr
                table.insert(data_buffer, line)
                
                -- 保存当前采样到历史记录中
                table.insert(history, {counter = counter, eu = eu})
                
                -- 每5秒计算一次 EU/t
                if counter % 5 == 0 then
                    -- 选择基准数据：寻找历史中距当前采样超过600秒（10分钟）的数据，
                    -- 如果没有，则使用最早的数据
                    local base_sample = history[1]
                    for i = 1, #history do
                        if history[i].counter <= counter - 600 then
                            base_sample = history[i]
                        else
                            break
                        end
                    end
                    
                    local dt = counter - base_sample.counter
                    if dt == 0 then dt = 1 end  -- 避免除0
                    local eu_diff = eu - base_sample.eu
                    local eu_per_tick = eu_diff / dt / 20
                    
                    -- 根据 dt 显示单位：小于60秒显示“秒”，大于等于60秒显示“分钟”（四舍五入）
                    local dt_unit, dt_value
                    if dt < 60 then
                        dt_unit = "秒"
                        dt_value = dt
                    else
                        dt_unit = "分钟"
                        dt_value = math.floor(dt / 60 + 0.5)
                    end
                    
                    local current_eu_str = formatNumber(eu)
                    local eu_per_tick_str = formatNumber(eu_per_tick)
                    local output = string.format("当前EU：%s. 最近%u%sEU/t: %s", 
                                          current_eu_str, dt_value, dt_unit, eu_per_tick_str)
                    print(output)
                    
                    printed_lines = printed_lines + 1
                    if printed_lines >= 50 then
                        -- 清屏：使用 ANSI 转义码
                        print("\27[2J\27[H")
                        printed_lines = 0
                    end
                    
                    -- 清除超过10分钟的历史数据
                    while #history > 0 and (counter - history[1].counter > 600) do
                        table.remove(history, 1)
                    end
                end
            else
                local line = current_time_str .. " 数字转换失败: 提取的字符串为 '" .. extracted .. "'\n"
                table.insert(data_buffer, line)
            end
        else
            local line = current_time_str .. " 无法提取到由数字和逗号组成的子串\n"
            table.insert(data_buffer, line)
        end
    else
        local line = current_time_str .. " 数据获取失败或索引23不存在\n"
        table.insert(data_buffer, line)
    end
    
    -- 每30秒写入一次文件
    if counter % 10 == 0 then
        post_data(data_buffer)
        data_buffer = {}  -- 清空缓冲区
    end
    
    os.sleep(1)
end

-- 注意：由于无限循环，通常不会执行到此处
file:close()
