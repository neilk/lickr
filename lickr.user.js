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
    function xpath_single_node(context_node, xpath) {
        return  document.evaluate( 
                     xpath,                              
                     context_node, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
                ).singleNodeValue;
    }

    
    var swf_td     = xpath_single_node(document, "//td[@class='photoswftd'][1]");
    if (swf_td == null) { return; }
    
    var swf_script = xpath_single_node(swf_td, "noscript/following-sibling::script[1]");
    if (swf_script == null) {
        alert("no swf script found! perhaps Flickr has changed.");
        return;
    }
    var script_text = swf_script.textContent;
   
   
    // image params in this 
    ps = new Object(); 
    
    // In the script, photo parameters look like:
    //     var ps_nsid = '77716109@N00';
    //     var ps_photo_id = '6232426';
    //     var ps_isfav = 0;							
    // We extract them with a regex. --> ps['is_fav'] = '0';
    // note even a number becomes a string.
    // n.b. this regex cannot handle escaped single quotes in strings.
    // unlikely to be a problem, all alphanumeric code data.

    var re = /var ps_(\w+)\s*=\s*('([^']*)'|(\d+))\s*;/g;
    var match;
    while (match = re.exec(script_text)) {
        ps[match[1]] = match[3];
    }
 
                   
    // OKAY!! we have all the info we need, so let's blow away what was there.
    var img = document.createElement('img');
    img.src = 'http://photos' + ps['photo_server'] + '.flickr.com/' 
                   + ps['photo_id'] + '_' + ps['photo_secret'] + '.jpg';
    img.style.borderColor = '#ff0000';
    img.style.borderWidth = 3;
    
    var div = document.createElement('div');
	div.appendChild(img);
    
    // replace, delete the node??
    swf_td.insertBefore(div, swf_script);
    swf_td.removeChild(swf_script);
    // var old_swf_script = swf_td.replaceChild(div, swf_script);
  
    //// just a test: the Title *does* get removed if this is uncommented.
    // var h1 = xpath_single_node(swf_td, "h1[1]");
    // swf_td.removeChild(h1);

    
})();


