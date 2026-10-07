// jsdom does not implement layout APIs; arrow-key navigation calls scrollIntoView.
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
