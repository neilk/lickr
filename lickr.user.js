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
// will probably need a generic spinner system... eventually.

(function() {

    // constants
    // http status
    OK = 200
    
    // xmlhttprequest readystate
    COMPLETE = 4
    


    function xpath_single_node(context_node, xpath) {
        return  document.evaluate( 
                     xpath,                              
                     context_node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue;
    }
    


    function do_post( proc_request, url, referer, data ) {
        var req = new XMLHttpRequest();
        req.onreadystatechange = function() { proc_request(req) };
        req.open('POST', url );

        if (referer != null) {
            req.setRequestHeader( 'Referer', referer );
        }
        
        req.setRequestHeader( 'Content-Type', 'application/x-www-form-urlencoded' );
        req.send( data );
    }



    
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
    // unfortunately, there is no info on the page that gives us the width and height
    // of the image. The Flash file width is not reliable for narrow images.
    // we can retrieve this info with the API, but not faster than a reflow anyway.
    
    div.appendChild(photo_img);


    // TOOLBAR

    // ---------------------------------------------
    // sizes

    var button = new Object;

    // XXX should not be there if it's our own picture. How to know?
    if (ps_candownload) {
        button['size'] = document.createElement('a');
        button['size'].href = 'http://flickr.com/photo_zoom.gne?id=' + ps_photo_id + '&size=m';
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
    
    if (ps_isfav) {
        button['fave'] = document.createElement('span');
        button['fave'].style.color = '#ff00ff';
        button['fave'].appendChild(document.createTextNode('*'));
    } else {
        button['fave'] = document.createElement('a');
        button['fave'].href = '#';
    }

   
    // ---------------------------------------------
    // rotate 

    transform_url = '/_chat/settransform.gne'
    
    function proc_rotate_request(req) {
        if (req.readyState != COMPLETE) {
            return;
        }
        
        if( req.status != OK ) {
            alert("rotation request failed!")
            return;
        }

        // update the image in an unbelieveably cheesy way.
        // is there a method to force reload of an image at the same url? there has to be.
        photo_img.src = img_url + '?.rand=' + Math.floor(Math.random()*1000)
         
    }

    function photo_rotate() {
       var post_data = 'amount=1&id=' + ps_photo_id + '&action=rotate'
       do_post(proc_rotate_request, transform_url, null, post_data)
    }

    button['rota'] = document.createElement('a');
    button['rota'].href = '#';
    button['rota'].onclick = photo_rotate;


    // ---------------------------------------------
    // send to group
    button['sgrp'] = document.createElement('a');
    button['sgrp'].href = 'http://flickr.com/photo_sendto_group.gne?id=' + ps_photo_id;


    // ---------------------------------------------
    
    function proc_delete_request(req) {
        if (req.readyState != COMPLETE) {
            return;
        }
        
        if( req.status != OK ) {
            alert("deletion request failed!")
            return;
        }

        // currently this appears just to redirect us to the home page. without any
        // special notification about the photo being deleted.
        // but this is how flickr does it. 
        document.location.href = '/photos/' + ps_nsid + '/?deleted=' + ps_photo_id
         
    }

    function photo_delete() {
       confirm_delete = confirm("Are you sure you want to delete this photo? (This can not be undone.)")
       if (confirm_delete == false) return;

       var photo_url = '/photos/' + ps_nsid;
       var post_data = 'delete=' + ps_photo_id

       // oddly this POST appears to return the home page anyway. we bother to do
       // the second GET only to be exactly like the Flickr SWF.
       do_post(proc_delete_request, photo_url, null, post_data)
    }

    button['dele'] = document.createElement('a');
    button['dele'].href = '#';
    button['dele'].onclick = photo_delete;



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
