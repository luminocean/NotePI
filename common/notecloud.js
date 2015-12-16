/**
 * 提供使用的notecloud接口，将通过消息传递机制与notecloud模块进行交互
 * 建议所有用户使用本模块来调用存储服务
 */
var notecloud = {
    'page': null,
    'sync': null
};

!function(){
    // 从google drive端获取页面对象
    notecloud.page = function(url, callback){
        chrome.runtime.sendMessage({
            'command': 'page',
            'data': url
        }, function(page){
            callback(page);
        });
    };

    // 将本地修改过的page对象同步到google drive上
    notecloud.sync =  function(page, callback){
        chrome.runtime.sendMessage({
            'command': 'sync',
            'data': page
        }, function(){
            callback();
        });
    };
}();
