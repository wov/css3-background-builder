
define(function(require,exports){

    /** 扩展对象，仅适用在单层的扩展中
     * @param {Object} merge 来源对象
     * @param {Object} tar 扩展的目标对象
     * @param {Boolean} safe 是否进行安全的扩展，只扩展目标对象中已有的属性
     */
    function extend (merge, tar, safe) {
        var already;
        if (!safe) {
            already = function () { return true; };
        }
        else {
            already = function (obj, proper) {
                return obj.hasOwnProperty(proper);
            }
        }
        if (merge != null && tar != null) {
            var src, copy, name;
            for (name in merge) {
                if (merge.hasOwnProperty(name)) {
                    copy = merge[name];
                    if (tar === copy) {
                        continue;
                    }
                    //只覆盖已定义的属性？
                    if (copy !== undefined && already(tar, name)) {
                        tar[name] = copy;
                    }
                } //if-END
            } //for-END
            return tar;
        } //if-END
    }

    /** 使用原型链接来创建新对象
     * @param {Object} obj 要赋予原型的对象
     */
    function pro (obj) {
        var Func = function () { };
        Func.prototype = obj;
        return new Func();
    } //var pro - END

    //start : 初始点击时触发 返回 坐标
    //click : 模拟点击事件,在手持设备上直接使用 'onclick' 会有比较难看的边缘,并且对transform变换的东西比较好把控  返回坐标点
    //dbclick : 模拟双击事件 返回坐标点
    //move  : 轴滑动事件 , 返回 轴方向 距离值  . 轴方向 : 'x' , 'y'  . 距离可以为负值

    //zoom : 放大和缩小 , 实际实现过程为 在start的时候 需要2个点 . 之后判断这个两个点是不是在接近或者变远.
    //gesture : 不需要反馈坐标的手势事件 ,返回手势的名字 这里先参考苹果的手势...
    //prevent   : 阻止浏览器默认事件的方式  默认有 'x' , 'y' ,'all' 即 横向,纵向,还有全部默认
    //userSelect : 阻止选中元素内的内容 产生难看的选择背景等

    function iTouch(param){
        var defP = {
            element: false,
            start  : false,
            dbclick : false,
            click: false,
            move : false,
            hover:false,
            end  : false,
            sliceEnd : false,
            startZoom : false,
            zoom:false,
            gesture : false,
            prevent : false,
            userSelect : false,
            multiple : true
        };
        var newFun = pro(Fn);
        extend(param, defP, true);
        extend(defP, newFun);
        newFun.init();
        return newFun;
    }

    var Fn = {
        init:function(){

            if(!this.element){
                return false;
            }

            //click 点击误差范围
            this.errorRange = 10;

            //停留时间 如果超过该值则不用触发click事件
            this.holdon = 1000; //单位为毫秒

            //用来判断是否引起双击事件的.记录的是click 的时间点堆栈
            this.clickRecord = [];

            //dom元素针对页面的偏移量
            this.offset = this.getOffset(this.element);

            if(this.userSelect){
                this.element.style.mozUserSelect = 'none';
                this.element.style.webkitUserSelect = 'none';
                //for ie
                this.element.onselectstart=function(){
                    return false;
                }
            }

            //测试是否具有touch事件.
            //支持touch事件 : touchstart touchmove thouchend
            //不支持touch事件 : mousedown mousemove mouseup
            var _hasTouch = !!("ontouchstart" in window);
            if(_hasTouch){
                this.bindtouchEvents();
            }else{
                this.bindclickEvents();
            }
        },

        bindtouchEvents : function(){
            var self = this;
            var ele = this.element;

            ele.addEventListener('touchstart',function(e){

                if(!this.multiple && e.targetTouches.length > 1){return false;}

                self.startEv = self.startEv || {};

                //更新元素的页面偏移量
                self.offset = self.getOffset(self.element);

                //用来判断的时间
                self.startEv.time = self.getTime();
                //用来存储触摸点的数量
                self.startEv.points = [];

                // if(this.multiple){
                for(var n = 0 ; n< e.targetTouches.length ; n++){
                    var point = {};
                    point.x = e.targetTouches[n].pageX;
                    point.y = e.targetTouches[n].pageY;
                    self.startEv.points.push(point);
                }
                // }

                //只有当一个点击的时候才触发start事件..
                if(self.startEv.points.length === 1){
                    var sp = self.startEv.points[0];
                    var coord = {'x' : sp.x - self.offset.left , 'y' : sp.y - self.offset.top};
                    self.start && self.start.apply(self.element,[e,coord.x,coord.y]);
                }else if(self.startEv.points.length === 2 && this.multiple){
                    self.startZoom && self.startZoom.apply(null);
                }
            },false);

            ele.addEventListener('touchmove',function(e){
                if(!this.multiple && e.targetTouches.length > 1){return false;}

                //当事件捕获异常则重新来过.
                if(!self.startEv){return false;}
                // e.stopPropagation();

                //TODO : 以后在这里加入 zoom 手势 等
                if(self.startEv.points.length > 1 && this.multiple){
                    e.preventDefault();
                    //两个手指
                    if(self.startEv.points.length === 2){
                        var _offLeft = self.offset.left;
                        var _offTop = self.offset.top;
                        var sp1 = {x : self.startEv.points[0].x - _offLeft , y : self.startEv.points[0].y - _offTop};
                        var sp2 = {x : self.startEv.points[1].x - _offLeft , y : self.startEv.points[1].y - _offTop};

                        var mp1 = {x : e.targetTouches[0].pageX - _offLeft , y : e.targetTouches[0].pageY - _offTop};
                        var mp2 = {x : e.targetTouches[1].pageX - _offLeft , y : e.targetTouches[1].pageY - _offTop};

                        self.zoom && self.zoom.apply(null,[e,sp1,sp2,mp1,mp2]);
                    }
                    return false;
                }else{
                    self.moveEv = self.moveEv || {};

                    self.moveLists = self.moveLists || [];

                    var point = {};
                    point.x = e.targetTouches[0].pageX;
                    point.y = e.targetTouches[0].pageY;

                    //判断初始滑动的方向角度
                    if(!self.moveEv.angle){
                        var sp = self.startEv.points[0];
                        var angle = self.getAngle(sp.x,point.x,sp.y,point.y);

                        //阻止浏览器默认事件
                        if(!!self.prevent){
                            switch(self.prevent){
                                case 'x':
                                    if(Math.abs(angle) < 20 || Math.abs(angle) > 160 ){
                                        e.preventDefault();
                                    }
                                    break;
                                case 'y':
                                    if(Math.abs(angle) >70 && Math.abs(angle) < 110 ){
                                        e.preventDefault();
                                    }
                                    break;
                                case 'all':
                                        e.preventDefault();
                                    break;
                            }
                        }

                        //从左向右  left 2 right
                       if((angle > -45) && (angle <= 45)) {
                           self.moveEv.dir = 'lr';
                        }
                        // 从右向左移动判定  right 2 left
                        if((angle > 135) || (angle <= -135)) {
                            self.moveEv.dir = 'rl';
                        }
                        // 从上向下移动判定  up to down
                        if((angle > 45) && (angle <= 135)) {
                            self.moveEv.dir = 'ud';
                        }
                        // 从下向上移动判定  down to up
                        if((angle > -135) && (angle <= -45)) {
                            self.moveEv.dir = 'du';
                        }
                        self.moveEv.angle = angle;
                    }

                    //获取时间
                    var t = self.getTime();

                    //计算当前的实时速度 使用 this.speed 存储
                    if(self.moveEv.last){
                    var dis = Math.sqrt(Math.pow(Math.abs(point.x - self.moveEv.last.x), 2) +
                        Math.pow(Math.abs(point.y - self.moveEv.last.y), 2));
                        self.speed = dis/(t - self.moveEv.last.time);

                        //更新moveEv.last的 属性
                        self.moveEv.last.time = t;
                        self.moveEv.last.x = point.x;
                        self.moveEv.last.y = point.y;
                    }else{
                        self.moveEv.last = {};
                        self.moveEv.last.time = t;
                        self.moveEv.last.x = point.x;
                        self.moveEv.last.y = point.y;
                    }

                    var disX = point.x - self.startEv.points[0].x;
                    var disY = point.y - self.startEv.points[0].y;

                    var coord = {'x' : point.x - self.offset.left , 'y' : point.y - self.offset.top};

                    self.move && self.move.apply(ele,[e,self.moveEv.dir,disX,disY,coord.x,coord.y]);

                    //压入数组 计算瞬时速度和瞬时加速度
                    self.moveLists.push({'t':t,'x':point.x,'y':point.y});
                }
            },false);

            ele.addEventListener('touchend',function(e){
                self.end && self.end.apply(self.element,[]);

                //当事件捕获异常则重新来过.
                if(!self.startEv){return false;}
                // e.stopPropagation();

                //初始点
                var sp = self.startEv.points[0];
                var t = self.getTime();

                //click判断
                //TODO:当end的点有2个以上则不触发点击事件
                //当时间超过一定值 则不能触发click事件
                //没有发生过移动
                //或者移动距离小于 点击误差 这里暂定为 10px.
                //当两次click事件 时间差距 和 距离较小 时候 触发双击.

                if(!self.moveEv ||
                    Math.abs(self.moveEv.last.x - sp.x) < self.errorRange &&
                    Math.abs(self.moveEv.last.y - sp.y) < self.errorRange  ) {
                        //触发点击事件
                        if(t - self.startEv.time < self.holdon){

                            self.click && self.click.apply(self.element,[sp.x - self.offset.left,sp.y - self.offset.top]);

                            //是否还可以触发一次双击事件
                            if(self.clickRecord.length>=1){
                                var lastRecord = self.clickRecord[self.clickRecord.length -1];

                                //这里暂时定义事件为 500 ms
                                if(t-lastRecord.time < 500 &&
                                    Math.abs(sp.x - lastRecord.x) < self.errorRange &&
                                    Math.abs(sp.y - lastRecord.y) < self.errorRange){
                                    self.dbclick && self.dbclick.apply(self.element,[sp.x - self.offset.left,sp.y - self.offset.top]);
                                    //触发双击事件后 清空 点击事件列表
                                    self.clickRecord = [];
                                }
                            }
                            self.clickRecord.push({'time':t, 'x':sp.x, 'y':sp.y});
                        }
                }else{
                    //没有触发点击事件 则触发sliceEnd事件 返回即时速度和即时加速度
                    var ll = self.moveLists.length;
                    if(ll>2){
                        var ep1 = self.moveLists[ll - 1];
                        var ep2 = self.moveLists[ll - 2];

                        //最后的平均速度
                        var v = {};
                        //x轴方向
                        v.x = (ep1.x - ep2.x)/(ep1.t - ep2.t);
                        //y轴方向
                        v.y = (ep1.y - ep2.y)/(ep1.t - ep2.t);

                        self.sliceEnd && self.sliceEnd.apply(self.element,[v]);
                    }else{
                        //滑动获取维度过少,无法计算
                    }
                }

                //清空startEv 和 moveEv 两个对象
                self.startEv = null;
                self.moveEv = null;
                self.moveLists = [];
                // e.stopPropagation();
            },false);
        },

        bindclickEvents : function(){
            var self = this,
                ele = this.element,
                doc = document;

            this.addHandler(ele,'mousedown',function(e){
                self.startEv = self.startEv || {};

                //更新元素的页面偏移量
                self.offset = self.getOffset(self.element);

                //用来判断的时间
                self.startEv.time = self.getTime();
                //用来存储触摸点的数量
                self.startEv.points = [];

                var point = {};

                if(e.pageX || e.pageY){
                    point.x = e.pageX;
                    point.y = e.pageY;
                }else{
                    point.x = e.clientX + doc.body.scrollLeft +doc.documentElement.scrollLeft;
                    point.y = e.clientY + doc.body.scrollTop +doc.documentElement.scrollTop;
                }
                self.startEv.points.push(point);

                var coord = {'x' : point.x - self.offset.left , 'y' : point.y - self.offset.top};
                self.start && self.start.apply(self.element,[e,coord.x,coord.y]);
            },false);

            this.addHandler(ele,'mousemove',function(e){

                //没有mousedown的时候不采取任何操作.
                if(!self.startEv){return false;}

                self.moveEv = self.moveEv || {};
                self.moveLists = self.moveLists || [];

                var point = {};

                if(e.pageX || e.pageY){
                    point.x = e.pageX;
                    point.y = e.pageY;
                }else{
                    point.x = e.clientX + doc.body.scrollLeft +doc.documentElement.scrollLeft;
                    point.y = e.clientY + doc.body.scrollTop +doc.documentElement.scrollTop;
                }

                //判断初始滑动的方向角度
                if(!self.moveEv.angle){
                    var sp = self.startEv.points[0];
                    var angle = self.getAngle(sp.x,point.x,sp.y,point.y);

                    //阻止浏览器默认事件

                    //从左向右  left 2 right
                    if((angle > -45) && (angle <= 45)) {
                        self.moveEv.dir = 'lr';
                    }
                    // 从右向左移动判定  right 2 left
                    if((angle > 135) || (angle <= -135)) {
                        self.moveEv.dir = 'rl';
                    }
                    // 从上向下移动判定  up to down
                    if((angle > 45) && (angle <= 135)) {
                        self.moveEv.dir = 'ud';
                    }
                    // 从下向上移动判定  down to up
                    if((angle > -135) && (angle <= -45)) {
                        self.moveEv.dir = 'du';
                    }
                    self.moveEv.angle = angle;
                }

                //获取时间
                var t = self.getTime();

                //计算当前的实时速度 使用 this.speed 存储
                self.moveEv.last = self.moveEv.last || {};
                //更新moveEv.last的 属性
                self.moveEv.last.time = t;
                self.moveEv.last.x = point.x;
                self.moveEv.last.y = point.y;

                var disX = point.x - self.startEv.points[0].x;
                var disY = point.y - self.startEv.points[0].y;

                var coord = {'x' : point.x - self.offset.left , 'y' : point.y - self.offset.top};

                self.move && self.move.apply(ele,[e,self.moveEv.dir,disX,disY,coord.x,coord.y]);

                //压入数组 计算瞬时速度和瞬时加速度
                self.moveLists.push({'t':t,'x':point.x,'y':point.y});
            });


            //如果使用原生的click的事件的话 响应区域会较大
            this.addHandler(ele,'mouseup',function(e){
                self.end && self.end.apply(self.element,[]);
                //当事件捕获异常则重新来过.
                if(!self.startEv){return false;}

                //初始点
                var sp = self.startEv.points[0];
                var t = self.getTime();

                //click判断
                //当时间超过一定值 则不能触发click事件
                //没有发生过移动
                //或者移动距离小于 点击误差 这里暂定为 10px.
                //当两次click事件 时间差距 和 距离较小 时候 触发双击.

                if(!self.moveEv ||
                    Math.abs(self.moveEv.last.x - sp.x) < self.errorRange &&
                    Math.abs(self.moveEv.last.y - sp.y) < self.errorRange  ) {
                    //触发点击事件
                    if(t - self.startEv.time < self.holdon){

                        self.click && self.click.apply(self.element,[sp.x - self.offset.left,sp.y - self.offset.top]);

                        //是否还可以触发一次双击事件
                        if(self.clickRecord.length>=1){

                            var lastRecord = self.clickRecord[self.clickRecord.length -1];

                            //这里暂时定义事件为 500 ms
                            if(t-lastRecord.time < 500 &&
                                Math.abs(sp.x - lastRecord.x) < self.errorRange &&
                                Math.abs(sp.y - lastRecord.y) < self.errorRange){
                                self.dbclick && self.dbclick.apply(self.element,[sp.x - self.offset.left,sp.y - self.offset.top]);
                                //触发双击事件后 清空 点击事件列表
                                self.clickRecord = [];
                            }
                        }
                        self.clickRecord.push({'time':t, 'x':sp.x, 'y':sp.y});
                    }
                }else{
                    //没有触发点击事件 则触发sliceEnd事件 返回即时速度和即时加速度
                    var ll = self.moveLists.length;
                    if(ll>2){
                        var ep1 = self.moveLists[ll - 1];
                        var ep2 = self.moveLists[ll - 2];

                        //最后的平均速度
                        var v = {};
                        //x轴方向
                        v.x = (ep1.x - ep2.x)/(ep1.t - ep2.t);
                        //y轴方向
                        v.y = (ep1.y - ep2.y)/(ep1.t - ep2.t);

                        self.sliceEnd && self.sliceEnd.apply(self.element,[v]);
                    }else{
                        //滑动获取维度过少，无法计算
                    }
                }

                self.startEv = null;
                self.moveEv  = null;
                self.moveLists = [];
            });

            //当鼠标移出范围时 清空
            this.addHandler(ele,'mouseout',function(e){
                if(self.checkHover(e,this)){
                    self.startEv = null;
                    self.moveEv = null;
                    self.moveLists = [];
                }
            });
        },

        //检测是否移到内部元素上而形成的冒泡。
        checkHover : function(e,target){
            if(e.type=="mouseover"){
                return !this.contains(target,e.relatedTarget||e.fromElement) && !((e.relatedTarget||e.fromElement)===target);
            }else{
                return !this.contains(target,e.relatedTarget||e.toElement) && !((e.relatedTarget||e.toElement)===target);
            }
        },

        contains : function(parentNode,childNode){
            return parentNode.contains ? parentNode != childNode && parentNode.contains(childNode) : !!(parentNode.compareDocumentPosition(childNode) & 16);
        },

        //兼容的事件绑定
        addHandler : function(el,type,fn){
            if (el.addEventListener){
                el.addEventListener(type, fn, false);
            } else if (el.attachEvent){
                el.attachEvent('on'+ type, fn);
            }
        },

        getTime : function(){
            return new Date().getTime();
        },

        getAngle : function(x1, x2, y1, y2) {
            this.pi = this.pi || Math.PI;
            var x = x2 - x1;
            var y = y2 - y1;
            var angle = Math.atan2(y, x) * 180 / this.pi;
            return angle;
        },

        //获取点击在元素内的坐标
        //TODO : 在某些布局下会失效

        //或取元素的距页顶和页左的偏移量
        getOffset : function(dom){
            var top = dom.offsetTop;
            var left = dom.offsetLeft;
            if(dom.offsetParent != null){
                var off =  this.getOffset(dom.offsetParent);
                top += off.top;
                left += off.left;
            }
            return {'top':top,'left':left};
        }
};
//--------view model----------->>

    return iTouch;

});
