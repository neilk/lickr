// Lickr -- Flickr, without the Flash
// v.0.1 
// Author: Neil Kandalgaonkar <neilk@brevity.org>

// ==UserScript==
// @name      Lickr
// @namespace   http://brevity.org/greasemonkey
// @description   Interface for Flickr photo pages that does not use Macromedia Flash(tm).
// @include     http://www.flickr.com/photos/*
// @include     http://flickr.com/photos/*
// ==/UserScript=




// basic gist:
// we want to replace the swf with ordinary html imgs, and explicit calls to the Flickr API
// using javascript or resty things.

// XXX todo

// notes flash on load of image/page?
// rounded corners on notes.
// some closure-izers are not necessary.

// license of this code.


// like to have:
// less cheesy flash removal
// less cheesy image reloading (?)
// generic spinners in procs (?)
// cursor does not seem to update unless moved.
// move factory functions inside contexts so they need not be fully parsed...

(function() {
    

    //------------------------------------------------------------------------
    // constants
    // http status constants
    var OK = 200
    
    // xmlhttprequest readystate
    var COMPLETE = 4

    // dom
    // nodeType
    var TEXT_NODE = 3  
    
    // misc
    var API_KEY = 'de468b48e226d3e788d6e7d426412aba';
    // var DEBUG = true;
    
    // magic numbers: the flash file is larger than the img size by this much, due to 
    // toolbar and border
    var ps_w_flash_extra = 2
    var ps_h_flash_extra = 28

    // minimum width of flash file, due to toolbar. 
    // If flash file is this size, the width of the image cannot be determined
    var ps_w_flash_min = 362 
     
    
  
    //-------------------------------------------------------------------------
    // utility functions

    function xpath_single_node(context_node, xpath) {
        return  document.evaluate( 
                     xpath,                              
                     context_node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue;
    }
    
    function do_req( method, proc_request, url, referer, data ) {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() { proc_request(req) };
        req.open(method, url );

        if (referer != null) {
            req.setRequestHeader( 'Referer', referer );
        }
        
        if (data != null) {
            req.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded' );
            req.send( data );
        } else {
            req.send('');
        }
        
    }


    function procException(msg, req) {
        this.msg = msg
        this.req = req
    }
    
    
    // a proc just spins around waiting for the thing to succeed or fail
    // then calls a callback, if we got 200 OK message.
    function make_proc(op_name, ok_cb) {

        return function(req) { 
            
            try {
                // init progress
                document.body.style.cursor='progress';
                
                if (req.readyState != COMPLETE) {
                    return;
                }
                
                // if (alert_response) { alert(req.responseText); }
                
                if( req.status != OK ) {
                    throw new procException( op_name + " request status was '" + req.status + "'", req )
                }

                ok_cb(req);
                
            } catch(e) {
                
                // clean up progress
                document.body.style.cursor='default';
                
                if (e instanceof procException) {
                    alert( e.msg );
                    if (DEBUG) {
                        alert(e.req.responseText);
                    }
                } else {
                    throw(e);
                }
            }

            // clean up progress

            document.body.style.cursor='default';
        }
    }


    // this is wraps the spinning proc like above,
    // except it parses the flickr api response a little before deciding all is well,
    // and passing control to the all-is-well callback
    function make_flickr_api_proc(op_name, ok_cb) {

        function parse_and_ok_cb(req) {
            var rsp = req.responseXML.getElementsByTagName('rsp').item(0);
            if (rsp == null) {
                throw new procException( "Could not understand Flickr's response.", req );
            }
            
            var stat = rsp.getAttribute("stat");
            if (stat == null) {
                throw new procException( "Could not find status of Flickr request", req);
            }
  
            if (stat != 'ok') {
                if (stat == 'fail') {
                    var err_node = rsp.getElementsByTagName('err').item(0);
                    var err_msg = err_node.getAttribute("msg");
                    throw new procException( err_msg, req );
                } else {
                    throw new procException("Unknown error status: '" + stat + "'", req)
                }
            }

            ok_cb(req, rsp);
        }

        return make_proc(op_name, parse_and_ok_cb);
    }
    
    
    // construct a flickr api request, with method and args, 
    // if that worked, call callback with request object.
    function flickr_api_call( method, args, ok_cb ) {
        
         var url = '/services/rest/?api_key=' + API_KEY;
         url += '&method=' + encodeURIComponent(method);
         
         for (var key in args) {
             url += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(args[key])
         }
         
         var proc = make_flickr_api_proc( method, ok_cb )
         
         do_req('GET', proc, url, null, null)
    }



    // --------------------------------------------------------------------------
    // and now, we begin

    var swf_td     = xpath_single_node(document, "//td[@class='photoswftd'][1]");
    if (swf_td == null) { return; }

    
    // XXX this is only useful to find a place to insert the img now... probably a better way
    // why does innerHTML work for that other guy, anyway.
    var photo_insert_point = xpath_single_node(swf_td, "noscript/following-sibling::script[1]"); 
   
    // okay, let's blow away the swf 
    // if FF is slow to remove the Flash, it will take even LONGER to abort/remove it.
    // ideally we should prevent the Flash object from ever being added to the DOM, but
    // no one yet knows how to prevent an inline JS from running.
    var swf = xpath_single_node(swf_td, "//object[1]").parentNode;
    swf_td.removeChild(swf);
    
    // okay let's get inserting
    
    var photo_div = document.createElement('div');
    photo_div.style.position = 'relative';  // what does this do??
    photo_div.style.margin = '5px'; // lines up with other elements better.

    // and show the div!
    swf_td.insertBefore(photo_div, photo_insert_point);

    // the image
    // all the ps_* vars are defined in a script on the photo pages
    
    var photo_img = document.createElement('img');
    photo_img.style.borderColor = '#000000';
    photo_img.style.borderWidth = 1;
    
    // having real image width and height eliminates dancing at page load
    // n.b. the toolbar in the flash file forces a minimum width, so we can't know the true width of
    // narrow photos. The following is a compromise that generally produces the least dancing
    // of title and image, given this imperfect information.
    // we could use Flickr API to get the real width, but the problem there is that the API
    // call is async. We can't wait on it, not without rewriting everything. So the page would
    // proceed merrily along, and actually look worse (title element gets smushed into small space).
    if (ps_w_flash > ps_w_flash_min) {
        photo_img.width = ps_w_flash - ps_w_flash_extra;
    }
    photo_img.height = ps_h_flash - ps_h_flash_extra; 
   
    var img_url = 'http://photos' + ps_photo_server + '.flickr.com/' 
                   + ps_photo_id + '_' + ps_photo_secret + '.jpg';
    photo_img.src = img_url;
    
    photo_div.appendChild(photo_img);
    
    var note_insert_point = document.createElement('span');
    photo_div.appendChild(note_insert_point);


    // ---------------------------------------------
    // notes

    /*<note id="313" author="12037949754@N01"
			authorname="Bees" x="10" y="10"
			w="50" h="50">foo</note> */
 

/* --------------- DOM-DRAG ----------------------- */
// Aaron Boodman.
// move within Note object thingy.
var Drag = {

	obj : null,

	init : function(o, set_bounding, onDragStart, onDrag, onDragEnd)
	{
        o.onmousedown	= Drag.start;

        o.set_bounding = set_bounding;
        

        // loop?
        o.onDragStart =  (onDragStart != null) ? onDragStart : function(){};
        o.onDrag =       (onDrag      != null) ? onDrag      : function(){};
        o.onDragEnd =    (onDragEnd   != null) ? onDragEnd   : function(){};
	},

	start : function(e)
	{
		var o = Drag.obj = this;
		var y = parseInt(o.style.top);
		var x = parseInt(o.style.left);
       
        // this could be set for all of them, after a successful drag, instead. 
        bounds = o.set_bounding();
        o.minX = bounds[0];
        o.maxX = bounds[1];
        o.minY = bounds[2];
        o.maxY = bounds[3];
		
        o.onDragStart(x, y);

		o.lastMouseX	= e.clientX;
		o.lastMouseY	= e.clientY;
	    o.minMouseX	= e.clientX - x + o.minX;
		o.maxMouseX	= o.minMouseX + o.maxX - o.minX;
		o.minMouseY	= e.clientY - y + o.minY;
        o.maxMouseY	= o.minMouseY + o.maxY - o.minY;

		document.onmousemove	= Drag.drag;
		document.onmouseup		= Drag.end;

		return false;
	},

	drag : function(e)
	{
		var o = Drag.obj;

		var ey	= e.clientY;
		var ex	= e.clientX;
		var y = parseInt(o.style.top);
		var x = parseInt(o.style.left);
		var nx, ny;

		ex = Math.max(ex, o.minMouseX);
		ex = Math.min(ex, o.maxMouseX);
		ey = Math.max(ey, o.minMouseY);
		ey = Math.min(ey, o.maxMouseY);

		nx = x + ex - o.lastMouseX;
		ny = y + ey - o.lastMouseY;

		Drag.obj.style.left = nx + "px";
		Drag.obj.style.top = ny + "px";
		Drag.obj.lastMouseX	= ex;
		Drag.obj.lastMouseY	= ey;

		Drag.obj.onDrag(nx, ny);
		return false;
	},

	end : function()
	{
		document.onmousemove = null;
		document.onmouseup   = null;
		Drag.obj.onDragEnd(	parseInt(Drag.obj.style.left), 
									parseInt(Drag.obj.style.top)   );
		Drag.obj = null;
	},

};


/* --------------- end DOM-DRAG ----------------------- */
        
    var Notes = new Array();    

    
    function visiblizer( elm, vis ) {
        return function() {
            elm.style.visibility = vis ? 'visible' : 'hidden';
        }
    }
  
   

    var notes_span;
    var texts_span;


    function flash_notes() {             
        notes_span.style.visibility = 'visible';
        // this can actually go before people see it...
        // need to have this flash triggered when the page is fully loaded or something.
        timeout_hide_notes();
    }
    

    var notes_hider_timeout;

    function timeout_hide_notes() {
       // alert("timing out!");
       if (notes_hider_timeout != null) {
            clearTimeout(notes_hider_timeout);
       }
       notes_hider_timeout = setTimeout( visiblizer( notes_span, false ), 2000 );
    }

   
   
    function remake_notes() {}; // forward declaration (??); 
   
    
    function Note(n) {
        for (var prop in n) {
            this[prop] = n[prop];
        }
        
        Notes.push(this);

        this.x2 = this.x + this.w; 
        this.y2 = this.y + this.h;
        
        // defining each note div:
        
        //  notes_span (visible or hidden)
        //   highlight_div (yellow)                           }
        //   this.inner_rect_div (black square)                  }
        //   this.rect_div (white square, true boundary)           }  for each note
        //    ...
        //  texts_span (always in front of every rect)
        //   this.text_div (visible on mouseover of associated rect). } for each note
        //    ...
       
        this.highlight_rect_div = document.createElement('div');
        notes_span.appendChild(this.highlight_rect_div);

        this.rect_div = document.createElement('div');
        notes_span.appendChild(this.rect_div);
        
        this.inner_rect_div = document.createElement('div');
        notes_span.appendChild(this.inner_rect_div);

        this.text_div = document.createElement('div');
        texts_span.appendChild(this.text_div);

       
        // styling them all...
         
        this.rect_div.style.position = 'absolute';
        this.rect_div.style.left =this.x + 'px';            
        this.rect_div.style.top =this.y + 'px';
        this.rect_div.style.width =this.w + 'px';
        this.rect_div.style.height =this.h + 'px';
        this.rect_div.style.borderColor = '#000000';
        this.rect_div.style.borderStyle = 'solid';
        this.rect_div.style.borderWidth = '1px';
 /*        
        this.inner_rect_div.style.position = 'relative';
        this.inner_rect_div.style.width = (this.w - 2) + 'px';
        this.inner_rect_div.style.height = (this.h - 2) + 'px';
 */
        this.inner_rect_div.style.position = 'absolute';
        this.inner_rect_div.style.left = (this.x + 1) + 'px';            
        this.inner_rect_div.style.top = (this.y + 1) + 'px'
        this.inner_rect_div.style.width = (this.w - 2) + 'px';
        this.inner_rect_div.style.height = (this.h - 2) + 'px';
 
        this.inner_rect_div.style.borderColor = '#ffffff';
        this.inner_rect_div.style.borderStyle = 'solid';
        this.inner_rect_div.style.borderWidth = '1px';
        
        // XXX what if this is negative?
        this.highlight_rect_div.style.position = 'absolute';
        this.highlight_rect_div.style.left = (this.x - 2) + 'px';            
        this.highlight_rect_div.style.top = (this.y - 2) + 'px';
        this.highlight_rect_div.style.width = (this.w + 2) + 'px';
        this.highlight_rect_div.style.height = (this.h + 2) + 'px';
        this.highlight_rect_div.style.borderColor = '#ffff00';
        this.highlight_rect_div.style.borderStyle = 'solid';
        this.highlight_rect_div.style.borderWidth = '2px';
        this.highlight_rect_div.style.opacity = 0.5; // CSS 3, only newer Mozillas as of 2005.
        this.highlight_rect_div.style.visibility = 'hidden';

        
        this.text_div.style.position = 'absolute';
        this.text_div.style.left =this.x + 'px';            
        this.text_div.style.top = (this.y +this.h + 5) + 'px';
        this.text_div.style.padding = '5px';
        text_node = document.createElement('span');
        text_node.className = 'note_text';
        // show newlines as br's 
        var text_lines = this.text.split("\n");
        for (var i in text_lines) {
            text_node.appendChild( document.createTextNode(text_lines[i]) );
            if (i < (text_lines.length-1)) {
                text_node.appendChild( document.createElement('br') );
            }
        }
        this.text_div.appendChild(text_node);
       
        // if the note author is the person who made the note, yellow without signature
        // alert( 'note.author = ' +this.author + ' ps_nsid = ' + ps_nsid );
        if (this.author == ps_photo_character_id) {
           this.text_div.style.background = '#fff9cc';
        // notes from other people are green with signature
        } else {
           this.text_div.style.background = '#ccffb0';
           if (this.id) { // if it was retrieved, not a new one we're creating
                var author = document.createElement('i')
                // only way to get entities is to use innerHTML, apparently. use UNESCAPE!!
                author.innerHTML = ' &ndash;&nbsp;' +this.authorname;
                this.text_div.appendChild(author);
           }
        }
        
        this.text_div.style.visibility = 'hidden';


        var note = this;  // to disambiguate "this" inside these next functions.

        this.show = function() {
            clearTimeout(notes_hider_timeout);
            note.text_div.style.visibility = 'visible';
            note.highlight_rect_div.style.visibility = 'visible';
        }

        this.hide = function() {
            note.text_div.style.visibility = 'hidden';
            note.highlight_rect_div.style.visibility = 'hidden';
        }


        this.inner_rect_div.addEventListener( "mouseover", this.show, false );
        this.inner_rect_div.addEventListener( "mouseout", this.hide, false );

        this.save = function() {
            // gather all changed params. 
            // Or? assume dims have been updated already, since mouse event must have happened.?
            // XXX note.x
            // XXX note.y
            // XXX note.w
            // XXX note.h
            note.text = note.textarea.value;
           
            if (note.id != null) {
                 
                flickr_api_call( 
                    "flickr.photos.notes.edit", 
                    { 
                        'note_id'   : note.id,
                        'note_x'    : note.x,
                        'note_y'    : note.y,
                        'note_w'    : note.w,
                        'note_h'    : note.h,
                        'note_text' : note.text
                    }, 
                    remake_notes 
                );
            } else {

                flickr_api_call(
                    "flickr.photos.notes.add",
                    {
                        'photo_id'  : ps_photo_id,
                        'note_x'    : note.x,
                        'note_y'    : note.y,
                        'note_w'    : note.w,
                        'note_h'    : note.h,
                        'note_text' : note.text
                    },
                    remake_notes
                );
            }
            
        }


        this.del = function() {
            flickr_api_call( "flickr.photos.notes.delete", { 'note_id' : note.id }, remake_notes );
        }

        this.resizeBegin = function() { 
            note.text_div.style.visibility = 'hidden';
        }

        this.resizeEnd = function() {
            // store new dims in the object.
            note.x = parseInt(note.rect_div.style.left);
            note.y = parseInt(note.rect_div.style.top);
            note.w = parseInt(note.rect_div.style.width);
            note.h = parseInt(note.rect_div.style.height);

            // and move the note div back.
            note.text_div.style.left = note.x + 'px';
            note.text_div.style.top = (note.y + note.h + 5) + 'px';
            note.text_div.style.visibility = 'visible';
        }

        this.edit = function() {
            // this note becomes "modal"... 
            // remove all listeners. 
            for (var i in Notes) {
                n = Notes[i];
                n.inner_rect_div.removeEventListener( "mouseout", n.hide, false );
                n.inner_rect_div.removeEventListener( "mouseover", n.show, false );
                n.inner_rect_div.removeEventListener( "mousedown", n.edit, false );
            }
            // mouseover / mouseout for photo_img.
            photo_img.removeEventListener("mouseover", photo_img.reveal_notes, false );
            photo_img.removeEventListener("mouseout",  timeout_hide_notes, false );

            note.textarea = document.createElement("textarea");
            note.textarea.style.width = '20em';
            note.textarea.style.height = '5em';
            // matching the style of the page.
            note.textarea.style.fontFamily = 'Arial, Helvetica, sans-serif';
            note.textarea.style.fontSize = '12px';
            note.textarea.appendChild(document.createTextNode(note.text))

            // want the author to appear on a separate line,
            // if there is one.
            textarea_span = document.createElement('span');
            textarea_span.appendChild( note.textarea );
            if (note.author != ps_photo_character_id) {
                textarea_span.appendChild(document.createElement('br'));
            }
            
            // swap note text for textarea
            var kids = note.text_div.childNodes;
            for (var i = 0; i < kids.length; i++) {
                if (kids[i].className == 'note_text') {
                    note.text_div.replaceChild(textarea_span, kids[i]);
                }
            }
            
            var button =  document.createElement("span");
            button.href = '#';
            button.style.paddingLeft = '0.6em';
            button.style.paddingRight = '0.6em';
            button.style.paddingTop = '0.3em';
            button.style.paddingBottom = '0.3em';

            var make_button = function(text, onclick, className) {
                var b = button.cloneNode(false);
                b.onclick = onclick;
                b.className = className; 
                b.appendChild( document.createTextNode( text ) );
                return b;
            }
            
            // XXX use clone here to save time... 
            var save_button = make_button('SAVE', note.save, 'Butt');
            var cancel_button = make_button('CANCEL', remake_notes, 'DeleteButt');
            var delete_button = make_button('DELETE', note.del, 'DeleteButt');
           
            buttons_div = document.createElement('div');
            buttons_div.style.position = 'relative';
            buttons_div.style.marginTop = '0.75em'; 
            buttons_div.style.marginBottom = '0.5em'; 
            buttons_div.appendChild(save_button);
            buttons_div.appendChild(document.createTextNode(' '));
            buttons_div.appendChild(cancel_button);
            buttons_div.appendChild(document.createTextNode(' '));
            buttons_div.appendChild(delete_button);

            note.text_div.appendChild(buttons_div);

            
            // dashed line, black dashes on white.
            note.highlight_rect_div.style.visibility = 'hidden';
            note.inner_rect_div.style.left = note.x + 'px';
            note.inner_rect_div.style.top = note.y + 'px';
            note.inner_rect_div.style.width = note.w + 'px';
            note.inner_rect_div.style.height = note.h + 'px';
            note.inner_rect_div.style.borderStyle = 'dotted';
            

            var handle_size = 6;
            
            handle_div = document.createElement("div");
            handle_div.style.width = handle_size + 'px';
            handle_div.style.height = handle_size + 'px';
            handle_div.style.position = 'absolute';
            handle_div.style.borderColor = '#000000';
            handle_div.style.borderStyle = 'solid';
            handle_div.style.borderWidth = '1px';
            handle_div.style.background = '#ffffff';

            note.handle = new Array();
            for (i=0; i<4; ++i) {
                note.handle[i] = handle_div.cloneNode(true);
                notes_span.appendChild(note.handle[i]);
            }
           
            // handles at corners: 
            // 0 1
            // 3 2

            note.rects = [ note.inner_rect_div, note.rect_div ];
            
            function position_handles() {
                note.handle[0].style.left = note.x;
                note.handle[0].style.top = note.y;
                note.handle[1].style.left = note.x2 - handle_size - 1;
                note.handle[1].style.top =  note.y;
                note.handle[2].style.left = note.x2 - handle_size - 1;
                note.handle[2].style.top = note.y2 - handle_size - 1;
                note.handle[3].style.left = note.x;
                note.handle[3].style.top = note.y2 - handle_size - 1;

                for (r in note.rects) {
                    note.rects[r].style.left = note.x;
                    note.rects[r].style.top = note.y;
                    note.rects[r].style.width = note.w;
                    note.rects[r].style.height = note.h;
                }
            }

            function resize() {
                note.w = note.x2 - note.x;  // alert("x2 = " + note.x2 + ", w = " + note.w)
                note.h = note.y2 - note.y;
                position_handles();        
            }

            function move() {
                note.x2 = note.x + note.w;
                note.y2 = note.y + note.h;
                position_handles();
            }
            
            resize(); 
            
            Drag.init(
                note.handle[0], 
                function() { return [
                    0, note.x2 - 2*handle_size - 1,
                    0, note.y2 - 2*handle_size - 1
                ]; },
                note.resizeBegin,
                function() { 
                    note.x = parseInt(note.handle[0].style.left);
                    note.y = parseInt(note.handle[0].style.top);
                    resize(); 
                },
                note.resizeEnd
            );

            Drag.init(
                note.handle[1], 
                function() { return [
                    note.x + handle_size + 1,  photo_img.width - handle_size - 1,
                    0, note.y2 - 2*handle_size - 1
                ] },
                note.resizeBegin,
                function() { 
                    note.x2 = parseInt(note.handle[1].style.left) + handle_size + 1;
                    note.y = parseInt(note.handle[1].style.top);
                    resize(); 
                },
                note.resizeEnd
            );
            

            Drag.init(
                note.handle[2], 
                function() {  return [
                    note.x + handle_size + 1, photo_img.width - handle_size - 1,
                    note.y + handle_size + 1, photo_img.height - handle_size - 1
                ] },
                note.resizeBegin,
                function() { 
                    note.x2 = parseInt(note.handle[2].style.left) + handle_size + 1;
                    note.y2 = parseInt(note.handle[2].style.top) + handle_size + 1;
                    resize(); 
                },
                note.resizeEnd
            );



            Drag.init(
                note.handle[3], 
                function() { return [
                    0, note.x2 - 2*handle_size - 1,
                    note.y + handle_size + 1, photo_img.height - handle_size - 1
                ] },
                note.resizeBegin,
                function() { 
                    note.x  = parseInt(note.handle[3].style.left);
                    note.y2 = parseInt(note.handle[3].style.top) + handle_size + 1;
                    resize(); 
                },
                note.resizeEnd
            );


            Drag.init(
                note.inner_rect_div,
                function() { return [  
                    1, photo_img.width - note.w, 1, photo_img.height - note.h,
                ] },
                note.resizeBegin,
                function() {
                    note.x = parseInt(note.inner_rect_div.style.left);
                    note.y = parseInt(note.inner_rect_div.style.top);
                    move();
                },
                note.resizeEnd
            );
        }
        
        // you can edit the note if: 
        if ( (global_nsid == ps_photo_character_id)  // you own the photo
                ||
             (global_nsid == this.author)  //   you are the note author
        ) {
            this.inner_rect_div.addEventListener( "mousedown",this.edit, false );
        }

        
    }         
   
    function notes_init() {
        // using spans instead of divs so as not to trigger block element.
        // n.b. these spans are global to this GM extension.
        notes_span = document.createElement('span');
        notes_span.id = 'notes';
        texts_span = document.createElement('span');
        texts_span.id = 'texts';        

        photo_div.insertBefore(notes_span,note_insert_point);
        photo_div.insertBefore(texts_span,note_insert_point);
       
        photo_img.reveal_notes =  visiblizer( notes_span, true );
        photo_img.addEventListener( "mouseover", photo_img.reveal_notes, false );
        
        photo_img.addEventListener( "mouseout",  timeout_hide_notes, false );
    } 
               
    function notes_retrieve(req, rsp) {
        
        notes_init();
        
        var collection = document.evaluate( "//note", rsp, null, XPathResult.ANY_TYPE, null );

        var node = collection.iterateNext();
        while (node) {
            n = new Object();
        
            n.id = node.getAttribute('id');
            n.author = node.getAttribute('author');
            n.authorname = node.getAttribute('authorname');
            n.x = parseInt(node.getAttribute('x'));
            n.y = parseInt(node.getAttribute('y'));
            n.w = parseInt(node.getAttribute('w'));
            n.h = parseInt(node.getAttribute('h'));
            n.text = '';
            nc = node.childNodes;
            for (var i in nc) {
                if (nc[i].nodeType == TEXT_NODE) {
                    n.text += nc[i].nodeValue;
                }
            }
            
            var note = new Note(n);
            
            node = collection.iterateNext();
        }

         
        flash_notes();
    }
    
    function make_notes() {
        flickr_api_call( "flickr.photos.getInfo", { 'photo_id':ps_photo_id }, notes_retrieve );
    }
    

    // if redrawing the notes, as in rotating, note editing.
    function remake_notes() {
        if (! Notes.length ) { return; }

        Notes = [];
        photo_div.removeChild( notes_span );
        photo_div.removeChild( texts_span );
        
        // and remake them    
        make_notes();
    }

    
    // Here's where it all begins.

    if ( xpath_single_node( document, "//span[@id='noteCount'][1]" ) != null ) {
        make_notes();
    }
    
    function photo_add_note() {
        // init notes if there aren't any
        if (notes_span == null) {
            notes_init();
        }
        var n = new Note( {
            x: 10, y: 10, w: 32, h: 32,
            text: 'Note text here.',
            author: global_nsid
        } );
        notes_span.style.visibility = 'visible';
        n.show();
        n.edit();
    }    

    // ---------------------------------------------
    // TOOLBAR
    var button = new Array();
    
    // the toolbar changes if the user owns the photo
    var is_owner = photo_hash[ps_photo_id].isOwner;
    var can_tag = (xpath_single_node(document,"//div[@id='tagadder'][1]") != null);
    

    // --------------------------------------------
    // add note
    // appears to use the same perms as adding tags
    if (can_tag) {
        var note_button = document.createElement('a');
        note_button.href = '#';
        note_button.onclick = photo_add_note;
        note_button.appendChild( document.createTextNode('Add Note') );
        button.push(note_button);
    }
    

    // ---------------------------------------------
    // sizes

    if (ps_candownload) {
        var size_button = document.createElement('a');
        
        // swf_zoom() is defined in page, picks the best size (large or original)       
        size_button.href = '#';
        size_button.onclick = swf_zoom; 
        size_button.appendChild( document.createTextNode('Sizes') );
        
        // but if that ever stops working, just set .href to :
        // '/photo_zoom.gne?id=' + ps_photo_id + '&size=m';
        button.push(size_button);

    } 


    // ---------------------------------------------
    // blog this    
    if (global_nsid) { // if logged in
        var blog_button = document.createElement('a');
        blog_button.href = 'http://flickr.com/blog.gne?photo=' + ps_photo_id;
        blog_button.appendChild( document.createTextNode('Blog This') );
        button.push(blog_button);
    }
   

    // ---------------------------------------------
    // send to group
    if (is_owner) {
        var sgrp_button = document.createElement('a');
        sgrp_button.href = 'http://flickr.com/photo_sendto_group.gne?id=' + ps_photo_id;
        sgrp_button.appendChild( document.createTextNode('Send to Group') );
        button.push(sgrp_button);
    }


    // ---------------------------------------------
    // favorite
  
    var fav_div;
     
    function fave_init() {
        fave_div = document.createElement('div');
        fave_div.id = 'fave_star';
        fave_div.style.cssFloat = 'right';
        fave_div.style.color = '#ff00ff';
        fave_div.style.fontSize = '0.8em';
        fave_div.style.textAlign = 'center';
        fave_div.style.position = 'relative';
        fave_div.style.top = '2.5em';
        fave_div.style.visibility = 'hidden';
         
        var fave_star = document.createElement('span'); 
        fave_star.style.fontSize = '4em';
        fave_star.style.lineHeight = '0px';
        fave_star.appendChild( document.createTextNode('*'));

        fave_div.appendChild(fave_star)
        fave_div.appendChild( document.createElement('br') );
        
        var t_span = document.createElement('span');
        t_span.appendChild(document.createTextNode('FAVE'));
        t_span.style.lineHeight = '1em';
        
        fave_div.appendChild( t_span );
                
        h1  = swf_td.getElementsByTagName('h1').item(0);

        var h1_fave = document.createElement('div')
        h1_fave.style.width = photo_img.width + 7; // to adjust for 7px margin on left.
        h1_fave.appendChild(fave_div);
        h1_fave.appendChild(h1);
            
        // swf_td.style.position = 'relative';
        swf_td.insertBefore(h1_fave, photo_div); 
    }

    function photo_fave() {        
        flickr_api_call( "flickr.favorites.add", { 'photo_id':ps_photo_id }, draw_fave );
    }

    function photo_unfave() {        
        flickr_api_call( "flickr.favorites.remove", {'photo_id':ps_photo_id }, draw_unfave );
    }


    var fave_button;

    function draw_fave() {
        fave_div.style.visibility = 'visible';
        // change the text... 
        fave_button.replaceChild( 
            document.createTextNode('Remove from Favorites'),
            fave_button.firstChild
        );
        fave_button.onclick = photo_unfave;
    }

    function draw_unfave() {
        fave_div.style.visibility = 'hidden';
        fave_button.replaceChild( 
            document.createTextNode('Add to Favorites'),
            fave_button.firstChild
        );
        fave_button.onclick = photo_fave;
    }

 
    if (!is_owner && global_nsid) { // not owner, but logged in...
        fave_init();
        var fave_button = document.createElement('a');
        fave_button.href = '#';
        fave_button.appendChild( document.createTextNode('Add to Favorites') );
        fave_button.onclick = photo_fave;
        button.push(fave_button)
        if (ps_isfav) {
            draw_fave();
        } else {
            draw_unfave();
        }
    }

   
    // ---------------------------------------------
    // rotate 
    // this could also be done with the api now that we have that??
   
    function rotation_ok() {
        // If we make the browser forget the dims, 
        // we force a clean reflow when once the new src has loaded.
        photo_img.removeAttribute('height')
        photo_img.removeAttribute('width')

        // cheesy random argument added so it does not hit cache.  
        photo_img.src = img_url + '?.rand=' + Math.floor(Math.random()*1000)

        remake_notes();
    }

    function photo_rotate() {
        flickr_api_call( "flickr.photos.transform.rotate", { 'photo_id':ps_photo_id, 'degrees':90 }, rotation_ok );
    }

    if (is_owner) {    
        var rota_button = document.createElement('a');
        rota_button.href = '#';
        rota_button.onclick = photo_rotate;
        rota_button.appendChild( document.createTextNode('Rotate') );
        button.push(rota_button);
    }


    



    // ---------------------------------------------
   
    
    function delete_ok() {
        // currently this appears just to redirect us to the home page. without any
        // special notification about the photo being deleted.
        // but this is how flickr does it. 
        document.location.href = '/photos/' + ps_nsid + '/?deleted=' + ps_photo_id
    }
    var delete_proc = make_proc('photo deletion', delete_ok)


    function photo_delete() {
       var confirm_delete = confirm("Are you sure you want to delete this photo? (This can not be undone.)")
       if (confirm_delete == false) return;

       var photo_url = '/photos/' + ps_nsid;
       var post_data = 'delete=' + ps_photo_id

       // oddly this POST appears to return the home page anyway. we bother to do
       // the second GET only to be exactly like the Flickr SWF.
       do_req('POST', delete_proc, photo_url, null, post_data)
    }


    if (is_owner) {
        var dele_button = document.createElement('a');
        dele_button.href = '#';
        dele_button.onclick = photo_delete;
        dele_button.appendChild( document.createTextNode('Delete') );
        button.push(dele_button);
    }






    // ---------------------------------------------
    // toolbar!
    
    
    if (button.length > 0) {
        var toolbar_p = photo_div.appendChild(document.createElement('p'));
        toolbar_p.style.color = '#666666';
        toolbar_p.appendChild( document.createTextNode( 'This Photo: ' ));
    
        for (var i = 0; i < button.length; ++i ) {
            
            toolbar_p.appendChild(button[i]);

            if (i+1 < button.length) {
                var bullet = document.createElement('span');
                // bullet.appendChild( document.createTextNode( unescape('&bull;') ) );
                // how does one get an entityReference from HTML? unescape doesn't work.
                // bullet.innerHTML = '&bull;';
                bullet.style.margin = '0em 0.3em 0em 0.3em';
                bullet.style.color = '#b0b0b0';
           
                toolbar_p.appendChild( bullet );
            }
        }
    }

})();

