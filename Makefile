XPIFILES = $(shell find chrome chrome.manifest components defaults install.rdf -type f)
../lastfm.xpi: $(XPIFILES)
	rm -f ../lastfm.xpi
	zip ../lastfm.xpi $(XPIFILES)
