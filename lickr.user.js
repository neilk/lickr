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
 
    // okay, let's blow away the swf 
    // if FF is slow to remove the Flash, it will take even LONGER to abort/remove it.
    // ideally we should prevent the Flash object from ever being added to the DOM, but
    // no one yet knows how to prevent an inline JS from running.
    var swf = xpath_single_node(swf_td, "//object[1]").parentNode;
    swf_td.removeChild(swf);
   
    // image params in this 
    ps = new Object(); 
    
    // In the script, photo parameters look like:
    //     var ps_nsid = '77716109@N00';
    //     var ps_photo_id = '6232426';
    //     var ps_isfav = 0;							
    // We extract them with a regex, and a little processing to strip away
    // those quotes, so              --> ps['is_fav'] = 0;
    //                                   ps['photo_id'] = '6232426';

    var re = /var ps_(\w+)\s*=\s*(\S+)\s*;/g;   // end quote mark for editor' 
    
    var match;
    //var all_matches = '';
    while (match = re.exec(script_text)) {
        if (match[1] == 'url') { break };  // end of useful vals.
        var val;
        if (match[2].charAt(0) == "'") {
            // assume bounded by single quotes
            val = match[2].substring(1, match[2].length - 1);
        } else {
            val = parseInt(match[2]);
        }
        ps[match[1]] = val;
        // all_matches += match[1] + ' => ' + val + ',' + typeof(val) + "\n";
    }
 
    // alert(all_matches);
                   

    // okay let's get inserting
    
    var div = document.createElement('div');

    // and show the div!
    swf_td.insertBefore(div, swf_script);


    // the image
    
    var img = document.createElement('img');
    img.src = 'http://photos' + ps['photo_server'] + '.flickr.com/' 
                   + ps['photo_id'] + '_' + ps['photo_secret'] + '.jpg';
    img.style.borderColor = '#ff0000';
    img.style.borderWidth = 3;
    img.width = ps['w_flash'] - 2;   // magic numbers, yes. They added em, for the flash interface.
    img.height = ps['h_flash'] - 28;
    
	div.appendChild(img);


    // TOOLBAR
    function pipe() { 
        return document.createTextNode(' | ')
    }

    
    // sizes

    var button = new Object;

    if (ps['candownload']) {
        button['size'] = document.createElement('a');
        button['size'].href = 'http://flickr.com/photo_zoom.gne?id=' + ps['photo_id'] + '&size=m';
    } else {
        button['size'] = document.createElement('span');
        button['size'].style.color = '#999999';
    }


    
    // blog this     
    button['blog'] = document.createElement('a');
    button['blog'].href = 'http://flickr.com/blog.gne?photo=' + ps['photo_id'];


    // favorite
    if (ps['isfav']) {
        button['fave'] = document.createElement('span');
        button['fave'].style.color = '#ff00ff';
        button['fave'].appendChild(document.createTextNode('*'));
    } else {
        button['fave'] = document.createElement('a');
        button['fave'].href = '#';
    }

    // XXX internationalize!!
    button['size'].appendChild(document.createTextNode('sizes'));
    button['blog'].appendChild(document.createTextNode('blog this'));
    button['fave'].appendChild(document.createTextNode('favorite'));

    div.appendChild(document.createElement('br'));
    div.appendChild(button['size']);
    div.appendChild(pipe());
    div.appendChild(button['blog']);
    div.appendChild(pipe());    
    div.appendChild(button['fave']);

      
})();


