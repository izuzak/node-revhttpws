PubSubHubBub + WebNotifications example
=======================================

This is the "PubSubHubBub + WebNotifications" example for the RevHttpWs proxy server.

The pshb-webnotif.html contains these parts:

* the publisher part which serves a PSHB enabled ATOM feed. A domain on a revhttpws server is registered and a HTTP handler is attached which serves the feed. Furthermore, when a new entry is added to the feed, a notification is published to a PubSubHubBub hub using a XHR request. New feed entries are generated and added each time the user clicks on a button.
* the subscriber part which subscribes for notifications of the publisher's feed. A new domain on a revhttpws server is registered and a HTTP handler is attached. The subscriber sends a subscription request to a PubSubHubBub hub using a XHR request and through the attached handler a) handles subscription verifications request from the hub and b) handles notifications of new feed entries. In case WebNotifications are supported and enabled, new feed notifications are displayed as WebNotifications. Otherwise, the entries are just written to a DIV.

See [the code for pshb-webnotif.html](https://github.com/izuzak/node-revhttpws/blob/master/examples/pshb-webnotif/pshb-webnotif.html) for more info.

You can also view the example at: [http://jsbin.com/iqibo/2](http://jsbin.com/iqibo/2)
