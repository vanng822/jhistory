## Usage

### $.history.init(callback)
	
	Should call it first and good just after the page is loaded. Callback is your ajax-handler
	
	$.history.init(function(url) {
		// do your ajax call and update content when getting response
		console.log(url);
	});
	
### $.history.load(url)

	$.history.load("/something");
	
	
### Binding the links example
	
	$("a").bind("click", function() {
		$.history.load(this.href);
		return false;
	});
	
