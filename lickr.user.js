// Lickr -- Flickr, without the Flash
//          Eye candy is dandy, but Lickr is quicker
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

// like to have:
// cheesy flash removal
// cheesy image reloading
// generic spinners in procs (?)
// cursor does not seem to update unless moved.
// move factory functions inside contexts so they need not be fully parsed...

(function() {
    

    
    //------------------------------------------------------------------------
    // constants
    // http status constants
    OK = 200
    
    // xmlhttprequest readystate
    COMPLETE = 4

    // dom
    // nodeType
    TEXT_NODE = 3  
    
    // misc
    API_KEY = '13f398c89f8c160c1c1428a8ba704710';
    DEBUG = true;
    
    // magic numbers: the flash file is larger than the img size by this much, due to 
    // toolbar and border
    ps_w_flash_extra = 2
    ps_h_flash_extra = 28

    // minimum width of flash file, due to toolbar. 
    // If flash file is this size, the width of the image cannot be determined
    ps_w_flash_min = 362 
     

  
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
                
                //alert(req.responseText);
                
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
            rsp = req.responseXML.getElementsByTagName('rsp').item(0);
            if (rsp == null) {
                throw new procException( "Could not understand Flickr's response.", req );
            }
            
            stat = rsp.getAttribute("stat");
            if (stat == null) {
                throw new procException( "Could not find status of Flickr request", req);
            }
  
            if (stat != 'ok') {
                if (stat == 'fail') {
                    err_node = rsp.getElementsByTagName('err').item(0);
                    err_msg = err_node.getAttribute("msg");
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
         
         proc = make_flickr_api_proc( method, ok_cb )
         
         do_req('GET', proc, url, null, null)
    }



    // --------------------------------------------------------------------------
    // and now, we begin

    var swf_td     = xpath_single_node(document, "//td[@class='photoswftd'][1]");
    if (swf_td == null) { return; }

    
    // XXX this is only useful to find a place to insert the img now... probably a better way
    // why does innerHTML work for that other guy, anyway.
    var swf_script = xpath_single_node(swf_td, "noscript/following-sibling::script[1]"); 
   
    // okay, let's blow away the swf 
    // if FF is slow to remove the Flash, it will take even LONGER to abort/remove it.
    // ideally we should prevent the Flash object from ever being added to the DOM, but
    // no one yet knows how to prevent an inline JS from running.
    var swf = xpath_single_node(swf_td, "//object[1]").parentNode;
    swf_td.removeChild(swf)
    
    // okay let's get inserting
    
    var photo_div = document.createElement('div');
    photo_div.style.position = 'relative';
    photo_div.style.margin = '5px'; // lines up with other elements better.

    // and show the div!
    swf_td.insertBefore(photo_div, swf_script);

    // the image
    // all the ps_* vars are defined in a script on the photo pages
    
    var photo_img = document.createElement('img');
    img_url = 'http://photos' + ps_photo_server + '.flickr.com/' 
                   + ps_photo_id + '_' + ps_photo_secret + '.jpg';
    photo_img.src = img_url;
    photo_img.style.borderColor = '#000000';
    photo_img.style.borderWidth = 1;
    
    // having real image width and height eliminates dancing at page load
    // n.b. the toolbar in the flash file forces a minimum width.
    // under a certain minimum, we can't determine original image width
    if (ps_w_flash > ps_w_flash_min) {
        photo_img.width = ps_w_flash - ps_w_flash_extra;
    }
    photo_img.height = ps_h_flash - ps_h_flash_extra; 

    
    photo_div.appendChild(photo_img);
    
    note_insert_point = document.createElement('span');
    photo_div.appendChild(note_insert_point);


    // ---------------------------------------------
    // notes

    // draw notes if there are any
    has_notes = (xpath_single_node( document, "//span[@id='noteCount'][1]" ) != null);

    var notes_hider_timeout;
    
/*<note id="313" author="12037949754@N01"
			authorname="Bees" x="10" y="10"
			w="50" h="50">foo</note> */
   

    
           
    function visiblizer( elm, vis ) {
        return function() {
            // alert("visiblizer hit");
            for (i in elm) {
                elm[i].style.visibility = vis ? 'visible' : 'hidden';
            }
        }
    }
  
    function show_note(highlight_rect_div, text_div) {
        return function() {
            clearTimeout(notes_hider_timeout)
            text_div.style.visibility = 'visible';
            highlight_rect_div.style.visibility = 'visible';
        }
    } 
     
    function hide_note(highlight_rect_div, text_div) {
        return function() {
            text_div.style.visibility = 'hidden';
            highlight_rect_div.style.visibility = 'hidden';
        }
    } 


    function draw_note(note, notes_span, texts_span) {
        

        // defining each note div:
        
        //  notes_span (visibile or hidden)
        //    highlight_div (behind and outside the rect_div).
        //    rect_div (white square, true boundary)
        //      inner_rect_div (black square)
        //  texts_span (always in front of every rect)
        //    text_div (visible on mouseover of associated rect).
        //    ...
       
        var highlight_rect_div = document.createElement('div');
        notes_span.appendChild(highlight_rect_div);
        
        var rect_div = document.createElement('div');
        notes_span.appendChild(rect_div);
        
        var inner_rect_div = document.createElement('div');
        rect_div.appendChild(inner_rect_div);

        
        var text_div = document.createElement('div')
        texts_span.appendChild(text_div);

        
        rect_div.addEventListener( "mouseover", show_note( highlight_rect_div, text_div ), false );
        rect_div.addEventListener( "mouseout", hide_note( highlight_rect_div, text_div ), false );
       
        // styling them all...
         
        rect_div.className = 'note_rect';
        rect_div.style.position = 'absolute';
        rect_div.style.left = note.x + 'px';            
        rect_div.style.top = note.y + 'px';
        rect_div.style.width = note.w + 'px';
        rect_div.style.height = note.h + 'px';
        rect_div.style.borderColor = '#ffffff';
        rect_div.style.borderStyle = 'solid';
        rect_div.style.borderWidth = '1px';
         
        inner_rect_div.className = 'inner_note_rect';
        inner_rect_div.style.width =  (note.w - 2) + 'px';
        inner_rect_div.style.height = (note.h - 2) + 'px';
        inner_rect_div.style.borderColor = '#000000';
        inner_rect_div.style.borderStyle = 'solid';
        inner_rect_div.style.borderWidth = '1px';
        
        highlight_rect_div.className = 'highlight_note_rect';
        highlight_rect_div.style.position = 'absolute';
        // what if this is negative?
        highlight_rect_div.style.left = (note.x - 1) + 'px';            
        highlight_rect_div.style.top = (note.y - 1) + 'px';
        highlight_rect_div.style.width = (note.w + 1) + 'px';
        highlight_rect_div.style.height = (note.h + 1) + 'px';
        highlight_rect_div.style.borderColor = '#ffff00';
        highlight_rect_div.style.borderStyle = 'solid';
        highlight_rect_div.style.borderWidth = '2px';
        highlight_rect_div.style.opacity = 0.5; // CSS 3, only newer Mozillas as of 2005.
        highlight_rect_div.style.visibility = 'hidden';

        
        // I used to have this inside the same div as the note, which would
        // have been easier for dragging both -- no absolute position.
        // but that div blocked other divs... (?)
        // can it be made to pass-through mouseovers?
        text_div.className = 'note_text';
        text_div.style.position = 'absolute';
        text_div.style.left = note.x + 'px';            
        text_div.style.top = (note.y + note.h + 5) + 'px';
        text_div.style.background = '#ffffcc';
        text_div.style.padding = '5px';
        text_div.appendChild( document.createTextNode(note.text) );
        text_div.appendChild( document.createElement('br') );
        author = document.createElement('i')
        author.appendChild( document.createTextNode('-- ' + note.authorname) );
        text_div.appendChild(author);
        
        text_div.style.visibility = 'hidden';
        //// this was for when it was relative to the img
        //text_div.style.marginTop = '5px';
        //text_div.style.padding = '5px';

    }


    function flash_notes(notes_div) {
 //alert("flashing notes " + note_rect.length);
              
        notes_div.style.visibility = 'visible';
        // this can actually go before people see it...
        // need to have this flash triggered when the page is fully loaded or something.
        timeout_hide_notes();
        
    }
    

    // var note_attrs = ['id','author','authorname','x','y','w','h']
    
    function timeout_hide_notes() {
       // alert("timing out!");
       notes_hider_timeout = setTimeout( visiblizer( [notes_span], false ), 2000 );
    }

    
    function notes_ok(req, rsp) {

        // using spans instead of divs so as not to trigger block element.
        notes_span = document.createElement('span');
        notes_span.id = 'notes';
        texts_span = document.createElement('span');
        texts_span.id = 'texts';
        
        var collection = document.evaluate( "//note", rsp, null, XPathResult.ANY_TYPE, null );

        var node = collection.iterateNext();
        while (node) {
            note = new Object();

            note.id = node.getAttribute('id');
            note.author = node.getAttribute('author');
            note.authorname = node.getAttribute('authorname');
            note.x = parseInt(node.getAttribute('x'));
            note.y = parseInt(node.getAttribute('y'));
            note.w = parseInt(node.getAttribute('w'));
            note.h = parseInt(node.getAttribute('h'));
            note.text = node.textContent;    

            draw_note(note, notes_span, texts_span);
            
            node = collection.iterateNext();
        }

        photo_div.insertBefore(notes_span,note_insert_point);
        photo_div.insertBefore(texts_span,note_insert_point);
        
        photo_img.addEventListener( "mouseover", visiblizer( [notes_span], true ), false );
        photo_img.addEventListener( "mouseout",  timeout_hide_notes, false );
         
        flash_notes(notes_span);
    }
    
    function make_notes() {
        flickr_api_call( "flickr.photos.getInfo", { 'photo_id':ps_photo_id }, notes_ok );
    }
    
    // if redrawing the screen, as in rotating...
    function remake_notes() {
        if (! has_notes ) { return; }

        photo_div.removeChild( notes_span );
        
        // and remake them    
        make_notes();
    }
        
    if ( has_notes ) {
        make_notes();
    }

    

    // ---------------------------------------------
    // TOOLBAR
    var button = new Array();
    
    // the toolbar changes if the user owns the photo
    is_owner = photo_hash[ps_photo_id].isOwner;


    // ---------------------------------------------
    // sizes

    if (ps_candownload) {
        size_button = document.createElement('a');
        
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
    // xxx only if logged in! 
    blog_button = document.createElement('a');
    blog_button.href = 'http://flickr.com/blog.gne?photo=' + ps_photo_id;
    blog_button.appendChild( document.createTextNode('Blog This') );
    button.push(blog_button);
   

    // ---------------------------------------------
    // send to group
    if (is_owner) {
        sgrp_button = document.createElement('a');
        sgrp_button.href = 'http://flickr.com/photo_sendto_group.gne?id=' + ps_photo_id;
        sgrp_button.appendChild( document.createTextNode('Send to Group') );
        button.push(sgrp_button);
    }


    // ---------------------------------------------
    // favorite
    // XXX only if logged in!
   
    fave_div = document.createElement('div');
    fave_div.id = 'fave_star';
    fave_div.style.cssFloat = 'right';
    fave_div.style.color = '#ff00ff';
    fave_div.style.fontSize = '0.8em';
    fave_div.style.textAlign = 'center';
    fave_div.style.position = 'relative';
    fave_div.style.top = '2.5em';
    fave_div.style.visibility = 'hidden';
     
    fave_star = document.createElement('span'); 
    fave_star.style.fontSize = '4em';
    fave_star.style.lineHeight = '0px';
    fave_star.appendChild( document.createTextNode('*'));

    fave_div.appendChild(fave_star)
    fave_div.appendChild( document.createElement('br') );
    
    t_span = document.createElement('span');
    t_span.appendChild(document.createTextNode('FAVE'));
    t_span.style.lineHeight = '1em';
    
    fave_div.appendChild( t_span );
            
    h1  = swf_td.getElementsByTagName('h1').item(0);

    h1_fave = document.createElement('div')
    h1_fave.style.width = photo_img.width + 7; // to adjust for 7px margin on left.
    h1_fave.appendChild(fave_div);
    h1_fave.appendChild(h1);
        
    // swf_td.style.position = 'relative';
    swf_td.insertBefore(h1_fave, photo_div); 

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
            document.createTextNode('Remove from favorites'),
            fave_button.firstChild
        );
        fave_button.onclick = photo_unfave;
    }

    function draw_unfave() {
        fave_div.style.visibility = 'hidden';
        fave_button.replaceChild( 
            document.createTextNode('Add to favorites'),
            fave_button.firstChild
        );
        fave_button.onclick = photo_fave;
    }

 
    if (!is_owner) { 
        fave_button = document.createElement('a');
        fave_button.href = '#';
        fave_button.appendChild( document.createTextNode('Add to favorites') );
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
        rota_button = document.createElement('a');
        rota_button.href = '#';
        rota_button.onclick = photo_rotate;
        rota_button.appendChild( document.createTextNode('Rotate') );
        button.push(rota_button);
    }


    // --- notes toolbar -- for ADDING notes.
    
    //if (is_owner) {
    //    note_button = document.createElement('a');
    //  note_button.href = '#';
    //  //note_button.onclick = photo_draw_notes;
    //}



    // ---------------------------------------------
   
    
    function delete_ok() {
        // currently this appears just to redirect us to the home page. without any
        // special notification about the photo being deleted.
        // but this is how flickr does it. 
        document.location.href = '/photos/' + ps_nsid + '/?deleted=' + ps_photo_id
    }
    delete_proc = make_proc('photo deletion', delete_ok)


    function photo_delete() {
       confirm_delete = confirm("Are you sure you want to delete this photo? (This can not be undone.)")
       if (confirm_delete == false) return;

       var photo_url = '/photos/' + ps_nsid;
       var post_data = 'delete=' + ps_photo_id

       // oddly this POST appears to return the home page anyway. we bother to do
       // the second GET only to be exactly like the Flickr SWF.
       do_req('POST', delete_proc, photo_url, null, post_data)
    }


    if (is_owner) {
        dele_button = document.createElement('a');
        dele_button.href = '#';
        dele_button.onclick = photo_delete;
        dele_button.appendChild( document.createTextNode('Delete') );
        button.push(dele_button);
    }






    // ---------------------------------------------
    // toolbar!
    
    toolbar_p = photo_div.appendChild(document.createElement('p'));
    // toolbar_p.className = 'topnavi';
    toolbar_p.style.color = '#666666';
    //toolbar_p.style.fontSize = 'smaller';
    toolbar_p.appendChild( document.createTextNode( 'This Photo: ' ));
    

    for (var i = 0; i < button.length; ++i ) {
        
        toolbar_p.appendChild(button[i]);

        if (i+1 < button.length) {
            bullet = document.createElement('span');
            // how does one get an entityReference from HTML?
            bullet.innerHTML = '&bull;';
            bullet.style.margin = '0em 0.3em 0em 0.3em';
            bullet.style.color = '#b0b0b0';
       
            toolbar_p.appendChild( bullet );
        }

    }

})();



/*
// cheesy spinner code. Can be put inside any of the post-request procs, in the 
//   if (req.readyState != COMPLETE) { }
    
     styles = ['#ff0000', '#ffff00', '#00ff00'];
     style_idx = 0;
         alert("not complete, and style_idx = " + style_idx);
    
     rota_button.appendChild( document.createTextNode('.') ); 
             rota_button.style.background = styles[style_idx]
             ++style_idx;
            if (style_idx > 2) { 
                style_idx = 0;
            }

        document.body.style.cursor='progress';
        document.body.style.cursor='default';
*/


    // // another way to transform...
    // transform_url = '/_chat/settransform.gne'
    // var post_data = 'amount=1&id=' + ps_photo_id + '&action=rotate'
    // rotate_proc = make_proc('photo rotation', rotation_ok);
    // do_req('POST', rotate_proc, transform_url, null, post_data)

