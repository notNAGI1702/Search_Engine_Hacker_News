CXX = g++
CXXFLAGS = -std=c++17 -O3 -I.

TARGETS = build/indexer build/ranker

all: $(TARGETS)

nlohmann/json.hpp:
	mkdir -p nlohmann
	curl -Lo nlohmann/json.hpp https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp

build/indexer: indexer.cpp nlohmann/json.hpp
	mkdir -p build
	$(CXX) $(CXXFLAGS) indexer.cpp -o build/indexer

build/ranker: ranker.cpp nlohmann/json.hpp
	mkdir -p build
	$(CXX) $(CXXFLAGS) ranker.cpp -o build/ranker

clean:
	rm -rf build nlohmann
