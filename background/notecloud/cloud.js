/**
 * 云端存储服务模块
 */
 require.config({
     paths: {
        'page': 'notecloud/page', // 由于在eventPage.js中已经指定了baseUrl，因此这里不用再写了
        'http': 'notecloud/http',
        'gdapi': 'notecloud/gdapi'
 　　}
 });

define(['page', 'gdapi'], function(Page, gdapi){
    // 在google drive上存储的根目录名
    var ROOT_NAME = 'notecloud';
    // 在每个页面文件夹中的页面数据名
    var PAGE_DATA_NAME = 'pagedata';
    // 内部存储的token值
    var token = '';
    // notecloud是否在本地模拟
    var isLocal = false;
    // 自动同步的时间间隔
    var autoSyncInterval = null;

    /**
     * 使用指定的页面url创建一个page存储对象
     * 如果云端没有这个页面的文件夹，则为其创建文件夹。否则加载文件夹中的内容
     * 最后返回该存储对象
     * @param  {String}   pageUrl  存储对象对应的url
     * @param  {Function} callback callback(err, page)
     */
    var page = function(pageUrl, callback){
        // 本地
        if(isLocal) return getLocalPage(pageUrl, callback);
        // 云端
        identify(function(){
            getCloudPage(pageUrl, callback);
        });
    };

    /**
     * 同步指定的页面数据
     * @param  {object}   page     要同步的页面数据
     * @param  {Function} callback callback(err, fileId)
     */
    var sync = function(page, callback){
        // 本地
        if(isLocal) return syncLocalPage(page, callback);
        // 云端
        identify(function(){
            syncCloudPage(page, callback);
        });
    };

    /**
     * 配置cloud
     * @param  {object} config 配置选项
     */
    var configuration = function(config){
        // 读取配置选项
        var local = config.local;
        var interval = config.autoSyncInterval;

        // 设置对应的数值
        if(local) isLocal = local;
        if(interval) autoSyncInterval = interval;
    };

    /**
     * 设置或取出google drive的token
     * @param  {String} t token字符串
     */
    var gdtoken = function(t){
        // 如果没有传入参数则返回当前token
        if(!t) return token;
        token = t;
    };

    // 身份验证，获取并设置token
    function identify(callback){
        chrome.identity.getAuthToken({'interactive': true}, function(tk){
            token = tk;
            callback();
        });
    }

    // 获取云端页面数据
    function getCloudPage(pageUrl, callback){
        console.debug('准备根目录...');
        prepareDir(token, ROOT_NAME, null, function(err, rootId){ // 这里的root指ROOT_NAME值的目录
            if(err) return callback(err);
            console.debug('准备页面目录...');
            // 每个页面都有自己的一个目录
            prepareDir(token, namify(pageUrl), rootId, function(err, pageDirId){
                console.debug('准备页面数据...');
                // 准备页面数据
                prepareFile(token, PAGE_DATA_NAME, pageDirId, function(err, fileId, pageData){
                    if(err) return callback(err);

                    var page = new Page();
                    page.__fileId__ = fileId;
                    page.__merge__(pageData);
                    page.__autoSync__(sync, autoSyncInterval);

                    callback(null, page);
                });
            });
        });
    }

    // 获取本地模拟页面数据
    // 注意由于chrome的限制，最大存储容量应该限制在5MB以内，因此请不要将page对象修改得太大，否则回存得时候可能会出现问题
    function getLocalPage(pageUrl, callback){
        var pageId = namify(pageUrl);
        // 如果没有就新建一个
        if(!chrome.storage.local[pageId])
            chrome.storage.local[pageId] = {};

        var localPage = chrome.storage.local[pageId];
        var page = new Page();

        // 设置pageId，同步的时候要用到
        page.__pageId__ = pageId;
        page.__merge__(localPage);
        page.__pageId__ = pageId;
        page.__autoSync__(sync, autoSyncInterval);

        callback(null, page);
    }

    // 同步云端数据页面
    function syncCloudPage(page, callback){
        // 包装Page对象
        page = new Page(page);

        var fileId = page.__fileId__;
        if(!fileId) return callback(new Error('page对象中找不到fileId'));

        console.debug("准备对%s进行同步...", fileId);
        gdapi.get(token, fileId, function(err, cloudPage){
            if(err) return callback(err);

            // 应该不需要先将云端数据合并到本地再上传，直接将本地上传覆盖就好了。所以这里先注了
            // page.__merge__(cloudPage);
            gdapi.update(token, {
                'fileId': fileId,
                'data': page
            }, function(err, fileId){
                callback(err, fileId);
            });
        });
    }

    // 在本地同步页面数据
    function syncLocalPage(page, callback){
        page = new Page(page);

        var pageId = page.__pageId__;
        if(!pageId)
            return callback(new Error("本地同步时找不到pageId"));

        console.debug("准备对%s进行同步...", pageId);
        chrome.storage.local[pageId] = page;
        callback(null, pageId);
    }

    /**
     * 准备指定文件
     * @param  {[type]}   token    token
     * @param  {[type]}   fileName 要准备（创建）的文件名称
     * @param  {[type]}   parentId 在指定父目录下创建文件，默认为root
     * @param  {Function} callback callback(err, fileId, pageData)
     */
    function prepareFile(token, fileName, parentId, callback){
        parentId = parentId || 'root';

        // 先搜索指定文件是否存在
        gdapi.search(token, fileName, parentId, function(err, fileId){
            if(err) return callback(err);
            // 如果文件不存在则创建
            if(fileId == null){
                console.debug('页面文件%s不存在，创建...', fileName);
                gdapi.upload(token, {
                    'metadata':{
                        'title': PAGE_DATA_NAME,
                        'parents':[{'id': parentId}]
                    },
                    'data': page, // 创建一个空文本
                }, function(err, newFileId){
                    if(err) return callback(err);
                    callback(null, newFileId, {});
                });
            }
            // 如果存在则获取该文件，返回
            else{
                console.debug('页面文件%s(%s)已经存在，获取中...', fileName, fileId);
                gdapi.get(token, fileId, function(err, pageData){
                    callback(null, fileId, pageData);
                });
            }
        });
    }
    /**
     * 准备指定目录，返回目录的id
     * 如果目录不存在则创建一个
     * @param  {String}   token         token
     * @param  {String}   dirName       要准备（创建）的目录名称
     * @param  {String}   parentId      在指定父目录下创建目录，默认为root
     * @param  {Function} callback      callback(err, fileId)
     */
    function prepareDir(token, dirName, parentId, callback){
        parentId = parentId || 'root';
        // 先搜索指定目录是否存在
        gdapi.search(token, dirName, parentId, function(err, fileId){
            if(err) return callback(err);
            // 如果目录不存在则创建
            if(fileId === null){
                gdapi.createFolder(token, dirName, parentId, function(err, fileId){
                    if(err) return callback(err);
                    callback(null, fileId);
                });
            }
            // 否则准备完成，返回
            else{
                callback(null, fileId);
            }
        });
    }

    /**
     * 将url转化为合法的文件名
     * @param  {String} url url地址字符串
     * @return {String}     文件名
     */
    function namify(url){
        // 去掉头部http
        var matches = url.match(/(?:http:\/\/)?([0-9a-z.\/]+)$/);
        var name = null;
        if(matches && matches.length > 1){
            name = matches[1];
        }else{
            name = url;
        }

        // 去掉所有的点和斜杠
        return name.replace(/\./g,'').replace(/\//g,'')
    }

    return {
        'gdtoken': gdtoken,
        'page': page,
        'sync': sync,
        'configuration': configuration
    };
});
