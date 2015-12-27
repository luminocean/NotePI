/**
 * pageshot相关后台服务
 * 注意，pageshot相关存储仍由notecloud.js模块提供
 */
!function(){
    chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse){
        // 截屏指令，返回当前页面的截图数据
        // 因为只有特权API才能进行截图，contentScript自己做不了
        if(msg.command === 'screenshot'){
            screenshot(function(dataUrl){
                sendResponse(dataUrl);
            });
            return true;
        }

        // 打开截图服务
        if(msg.command === 'openPageshot'){
            var dataURL = msg.data;
            openPageshot(dataURL, function(tabId){
                sendResponse(tabId);
            });

            return true;
        }
    });

    // 截屏
    function screenshot(callback){
        chrome.tabs.captureVisibleTab(function(dataUrl){
            callback(dataUrl);
        });
    }

    // 开启新标签页打开截图内容
    function openPageshot(url, callback){
        // 获取网页截图对象
        cloud.file(url, PAGESHOT_DATA_FILE, function(err, pageshot){
            if(err) return console.error(err);
            var dataURL = pageshot.data;

            // 获取消息源tab
            chrome.tabs.query({currentWindow: true, active : true},function(tabArray){
                var srcTab = tabArray[0];
                // 调用相关模块来显示截图
                chrome.tabs.create({
                    // 在这里偷偷的把源tab的tabId通过url参数传给了截图页面
                    'url': chrome.extension.getURL('content/pageshot/display.html')+'?src='+srcTab.id
                }, function(tab){
                    // 延时1秒再发送，否则会收不到
                    setTimeout(function(){
                        chrome.runtime.sendMessage({
                            'command': 'displayDataURL',
                            'data': {
                                'dataURL': dataURL
                            }
                        });

                        callback(tab.id);
                    }, 1000);
                });
            });
        });
    }
}();
