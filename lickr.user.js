// Lickr -- Flickr, without the Flash
//          Eye candy is dandy, but Lickr is quicker
// v.0.1 
// Author: Neil Kandalgaonkar <neilk@brevity.org>

// ==UserScript==
// @name      Lickr
// @namespace   http://brevity.org/greasemonkey
// @description   Flickr, without the Flash
// @include     http://www.flickr.com/photos/*
// @include     http://flickr.com/photos/*
// ==/UserScript=

// basic gist:
// we want to replace the swf with ordinary html imgs, and explicit calls to the Flickr API
// using javascript or resty things.
// 
// the parameters that the swf uses are located in a particular script on the page.
// we'll extract those and we'll be off to the races.

(function() {

    // constants
    // http status
    OK = 200
    
    // xmlhttprequest readystate
    COMPLETE = 4
    

    // magic numbers...
    flash_extra_width  = 2  // for the border
    flash_extra_height = 20 // for the border + toolbar




    
    function xpath_single_node(context_node, xpath) {
        return  document.evaluate( 
                     xpath,                              
                     context_node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue;
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
    
    var img = document.createElement('img');
    img_src = 'http://photos' + ps_photo_server + '.flickr.com/' 
                   + ps_photo_id + '_' + ps_photo_secret + '.jpg';
    img.src = img_src;
    img.style.borderColor = '#000000';
    img.style.borderWidth = 1;

    // lies! the image can be smaller than minimum toolbar. so we have to 
    // either count on the browser to size it, or get the info some other way.
    // img.width = ps_w_flash - flash_extra_width;
    // img.height = ps_h_flash - flash_extra_height;
    
	div.appendChild(img);


    // TOOLBAR

    
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


    
    // blog this     
    button['blog'] = document.createElement('a');
    button['blog'].href = 'http://flickr.com/blog.gne?photo=' + ps_photo_id;



    // favorite
    if (ps_isfav) {
        button['fave'] = document.createElement('span');
        button['fave'].style.color = '#ff00ff';
        button['fave'].appendChild(document.createTextNode('*'));
    } else {
        button['fave'] = document.createElement('a');
        button['fave'].href = '#';
    }

  

/*
# rotating essentials.

POST /_chat/settransform.gne HTTP/1.1
Cookie: cookie_accid=66122; cookie_epass=1e96f616dbeda20c6d50f69af939435b; cookie_session=66122%3A1e96f616dbeda20c6d50f69af939435b; use_master_until=1110799321

we may get the cookie for free, hee hee. 

amount=1&id=6232426&action=rotate&fuckSafari=stupidbu

*/
   
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
    
    
    // these procs are spun on lots of events apparently
    // check for readyState at start.
    function proc_rotate_request(req) {
		if (req.readyState != COMPLETE) {
            return;
        }

		if( req.status != OK ) {
            alert("rotation request failed!")
			// indicate failure somehow... others set a flag in a var...
        }

		// update the image in an unbelieveably cheesy way.
        // is there a method to force reload of an image at the same url? there has to be.
        img.src = img_src + '?.rand=' + Math.floor(Math.random()*100)
        //alert("we would update the image now")
        
	}

    transform_url = '/_chat/settransform.gne'

    function rotate() {
       var post_data = 'amount=1&id=' + ps_photo_id + '&action=rotate'
       post_data += '&fuckSafari=stupidbug' // necessary?
       
       do_post(proc_rotate_request, transform_url, null, post_data)
       
    }

    // rotate 
    button['rota'] = document.createElement('a');
    button['rota'].href = '#';
    button['rota'].onclick = rotate;

    // send to group
    button['sgrp'] = document.createElement('a');
    button['sgrp'].href = 'http://flickr.com/photo_sendto_group.gne?id=' + ps_photo_id;

    // XXX internationalize?
    var texts = new Object();
    texts['size'] = 'sizes';
    texts['blog'] = 'blog this'; 
    texts['fave'] = 'favorite';
    texts['sgrp'] = 'send to group';
    texts['rota'] = 'rotate';

    div.appendChild(document.createElement('br'));
    for (var i in button) {
        button[i].appendChild(document.createTextNode(texts[i])); // add the texts to the buttons

        div.appendChild(button[i]);
        div.appendChild( document.createTextNode(' | ') ); // lame, appears after row.
    }

})();


