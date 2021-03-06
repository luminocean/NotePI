/**
* 对新页面的检查
*/
var checkAPI = {};

define(function(done){
	done();

	function checkPageDom(pathSet){
		var noMatchIDs = [];
		if(typeof domRange !== 'undefined'){
			setTimeout(noMatchIDs=domRange.checkXPath(pathSet),1500);
		}
		var ratio = 0;
		if((0===pathSet.length) || (0===noMatchIDs.length)){
			ratio = 1;
		}
		else{
			if(noMatchIDs == 'undefined'){
				ratio = 1;
			}
			else{
				var pathNum = pathSet.length;
				var matchNum = pathSet.length - noMatchIDs.length;
				ratio = matchNum/pathNum;
			}
		}
		return {'noMatchIDs' : noMatchIDs,
				'ratio' : ratio};
	}

	function checkWidthHeight(saveData){
		var DEVIATION = 0.005;
		var curWidth = document.body.scrollWidth;
		var curHeight = document.body.scrollHeight;
		if(Math.abs(curWidth/curHeight-saveData.width/saveData.height) < DEVIATION){
			return true;
		}
		else{
			return false;
		}
		return true;
	}

	checkAPI.checkPage = function(saveData, pathSet, callback){
		var domResult = checkPageDom(pathSet);
		var sizeCheck = checkWidthHeight(saveData);
		if(sizeCheck){
			// alert("宽高没有发生变化！\n笔迹内容匹配率为："+(domResult.ratio*100).toFixed(1)+"%.");
			console.debug('宽高没有发生变化');
			domRange.checkNoteNotMatch(pathSet);
		}
		else{
			console.debug('宽高发生变化');
		}

		// 要返回的检查结果数据
		var checkData = {
			'noMatchIDs' : domResult.noMatchIDs,
			'ratio' : domResult.ratio,
			'sizeCheck' : sizeCheck
		};

		// 检查是否满足阈值
		chrome.runtime.sendMessage({command:"getMatchRatio"}, function(matchRatio){
			checkData.matches = (domResult.ratio >= matchRatio);
			// 返回检查结果
			callback(checkData);
		});
	}
});
