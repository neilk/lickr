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

// XXX tofix
// cheesy flash removal
// cheesy image reloading
// rotation using flickr api?
// notes!
// generic spinners in procs.
// cursor does not seem to update unless moved.
// move factory functions inside contexts so they need not be fully parsed...

(function() {
    

    
    //------------------------------------------------------------------------
    // constants
    // http status constants
    OK = 200
    
    // xmlhttprequest readystate
    COMPLETE = 4
    
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
                    return;
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

            // may want to pass rsp as well?
            ok_cb(req);
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
    
    var div = document.createElement('div');

    // and show the div!
    swf_td.insertBefore(div, swf_script);

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

    
    div.appendChild(photo_img);


    // ---------------------------------------------
    // TOOLBAR
    var button = new Object;
    
    // the toolbar changes if this is our photo.
    is_owner = photo_hash[ps_photo_id].isOwner;


    // ---------------------------------------------
    // sizes

    if (ps_candownload) {
        button['size'] = document.createElement('a');
        
        // swf_zoom() is defined in page, picks the best size (large or original)       
        button['size'].href = '#';
        button['size'].onclick = swf_zoom; 
        
        // but if that ever stops working, just set .href to :
        // '/photo_zoom.gne?id=' + ps_photo_id + '&size=m';

    } else {
        button['size'] = document.createElement('span');
        button['size'].style.color = '#999999';
    }


    // ---------------------------------------------
    // blog this     
    button['blog'] = document.createElement('a');
    button['blog'].href = 'http://flickr.com/blog.gne?photo=' + ps_photo_id;


    // ---------------------------------------------
    // favorite

    function photo_fave() {        
        flickr_api_call( "flickr.favorites.add", { 'photo_id':ps_photo_id }, draw_fave );
    }

    function photo_unfave() {        
        flickr_api_call( "flickr.favorites.remove", { 'photo_id':ps_photo_id }, draw_unfave );
    }
    
 
    function draw_fave() {
        button['fave'].style.color = '#ff00ff';
        button['fave'].onclick = photo_unfave;
    }

    function draw_unfave() {
        button['fave'].style.color = '#0066ff';
        button['fave'].onclick = photo_fave;
    }

 
    if (!is_owner) { 
        button['fave'] = document.createElement('a');
        button['fave'].href = '#';
        fave_star = document.createTextNode('*')
        button['fave'].appendChild(fave_star);

        if (ps_isfav) {
            draw_fave();
        } else {
            draw_unfave();
        }
    }

   
    // ---------------------------------------------
    // rotate 
    // this could also be done with the api now that we have that??
    
    transform_url = '/_chat/settransform.gne'
    
    function rotation_ok() {
        // If we make the browser forget the dims, 
        // we force a clean reflow when once the new src has loaded.
        photo_img.removeAttribute('height')
        photo_img.removeAttribute('width')

        // cheesy random argument added so it does not hit cache.  
        photo_img.src = img_url + '?.rand=' + Math.floor(Math.random()*1000)
    }

    function photo_rotate() {
       var post_data = 'amount=1&id=' + ps_photo_id + '&action=rotate'
       rotate_proc = make_proc('photo rotation', rotation_ok);
       do_req('POST', rotate_proc, transform_url, null, post_data)
    }

    if (is_owner) {    
        button['rota'] = document.createElement('a');
        button['rota'].href = '#';
        button['rota'].onclick = photo_rotate;
    }


    // ---------------------------------------------
    // send to group
    if (is_owner) {
        button['sgrp'] = document.createElement('a');
        button['sgrp'].href = 'http://flickr.com/photo_sendto_group.gne?id=' + ps_photo_id;
    }

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
        button['dele'] = document.createElement('a');
        button['dele'].href = '#';
        button['dele'].onclick = photo_delete;
    }



    // ---------------------------------------------
    // toolbar!
    
    // XXX internationalize?
    var texts = new Object();
    texts['size'] = 'sizes';
    texts['blog'] = 'blog this'; 
    texts['fave'] = 'favorite';
    texts['sgrp'] = 'send to group';
    texts['rota'] = 'rotate';
    texts['dele'] = 'delete';

    
    div.appendChild(document.createElement('br'));
    for (var i in button) {
        button[i].appendChild(document.createTextNode(texts[i])); // add the texts to the buttons

        div.appendChild(button[i]);
        div.appendChild( document.createTextNode(' | ') ); // lame, appears after row.
    }

})();



/*
// cheesy spinner code. Can be put inside any of the post-request procs, in the 
//   if (req.readyState != COMPLETE) { }
    
     styles = ['#ff0000', '#ffff00', '#00ff00'];
     style_idx = 0;
         alert("not complete, and style_idx = " + style_idx);
    
     button['rota'].appendChild( document.createTextNode('.') ); 
             button['rota'].style.background = styles[style_idx]
             ++style_idx;
            if (style_idx > 2) { 
                style_idx = 0;
            }

        document.body.style.cursor='progress';
        document.body.style.cursor='default';
*/
