#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <unordered_map>
#include <algorithm>
#include <cmath>
#include <cctype>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Use the exact same tokenizer
std::vector<std::string> tokenize(const std::string& text) {
    std::vector<std::string> tokens;
    std::string current;
    for (char c : text) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            current += std::tolower(static_cast<unsigned char>(c));
        } else {
            if (!current.empty()) {
                tokens.push_back(current);
                current.clear();
            }
        }
    }
    if (!current.empty()) {
        tokens.push_back(current);
    }
    return tokens;
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: " << argv[0] << " <query>" << std::endl;
        return 1;
    }

    std::string queryStr = argv[1];
    std::string indexPath = "../data/inverted_index.json";

    std::ifstream indexFile(indexPath);
    if (!indexFile.is_open()) {
        std::cerr << "Error: Could not open index file: " << indexPath << std::endl;
        std::cerr << "Ensure indexer has run successfully." << std::endl;
        return 1;
    }

    json indexJson;
    try {
        indexFile >> indexJson;
    } catch (const std::exception& e) {
        std::cerr << "Error parsing index JSON: " << e.what() << std::endl;
        return 1;
    }
    indexFile.close();

    int N = indexJson["doc_count"].get<int>();
    double avgDocLen = indexJson["avg_doc_len"].get<double>();
    
    // Parse doc_lengths
    std::unordered_map<int, int> docLengths;
    for (auto& [docIdStr, lenJson] : indexJson["doc_lengths"].items()) {
        docLengths[std::stoi(docIdStr)] = lenJson.get<int>();
    }

    // Tokenize query
    std::vector<std::string> queryTokens = tokenize(queryStr);
    if (queryTokens.empty()) {
        // Empty query results in no matches
        return 0;
    }

    // Accumulate BM25 scores: doc_id -> score
    std::unordered_map<int, double> docScores;

    const double k1 = 1.2;
    const double b = 0.75;

    auto indexObj = indexJson["index"];

    for (const auto& term : queryTokens) {
        if (!indexObj.contains(term)) {
            continue;
        }

        auto postings = indexObj[term];
        int nq = postings.size();

        // BM25 IDF
        double idf = std::max(1e-9, std::log((N - nq + 0.5) / (nq + 0.5) + 1.0));

        for (const auto& posting : postings) {
            int docId = posting[0].get<int>();
            int tf = posting[1].get<int>();

            int docLen = docLengths[docId];

            double num = tf * (k1 + 1.0);
            double den = tf + k1 * (1.0 - b + b * (docLen / avgDocLen));
            double score = idf * (num / den);

            docScores[docId] += score;
        }
    }

    // Sort documents by score descending
    std::vector<std::pair<int, double>> rankedDocs(docScores.begin(), docScores.end());
    std::sort(rankedDocs.begin(), rankedDocs.end(), [](const auto& a, const auto& b) {
        if (std::abs(a.second - b.second) < 1e-9) {
            return a.first < b.first; // Tie-breaker by doc_id asc
        }
        return a.second > b.second;
    });

    // Print doc_id and score to stdout
    for (const auto& [docId, score] : rankedDocs) {
        std::cout << docId << " " << score << "\n";
    }

    return 0;
}
