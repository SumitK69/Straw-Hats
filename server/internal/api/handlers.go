// Package api provides the REST API handlers.
package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/sentinel-io/sentinel/server/internal/store"
)

// generateTokenHandler creates a new enrollment token.
func generateTokenHandler(signingKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "sentinel-server",
		})

		tokenString, err := token.SignedString([]byte(signingKey))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token":      tokenString,
			"expires_in": 3600,
		})
	}
}

// searchOpenSearch executes a search query against OpenSearch.
func searchOpenSearch(c *gin.Context, osClient *store.Client, index string, defaultSort string) {
	query := c.Query("q")
	if query == "" {
		query = "*"
	}

	size := c.DefaultQuery("size", "50")

	// Simple query string search
	body := map[string]interface{}{
		"size": size,
		"sort": []map[string]interface{}{
			{defaultSort: map[string]string{"order": "desc"}},
		},
		"query": map[string]interface{}{
			"query_string": map[string]interface{}{
				"query": query,
			},
		},
	}

	reqBody, _ := json.Marshal(body)

	osResp, err := osClient.Search(c.Request.Context(), index, reqBody)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to query OpenSearch: " + err.Error()})
		return
	}

	hitsMap, ok := osResp["hits"].(map[string]interface{})
	if !ok {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	hits, ok := hitsMap["hits"].([]interface{})
	if !ok {
		c.JSON(http.StatusOK, gin.H{"data": []interface{}{}})
		return
	}

	results := make([]map[string]interface{}, 0, len(hits))
	for _, hit := range hits {
		source := hit.(map[string]interface{})["_source"].(map[string]interface{})
		source["_id"] = hit.(map[string]interface{})["_id"]
		results = append(results, source)
	}

	c.JSON(http.StatusOK, gin.H{"data": results})
}

func listAgentsHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		searchOpenSearch(c, osClient, "sentinel-agents*", "last_seen")
	}
}

func listAlertsHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		searchOpenSearch(c, osClient, "sentinel-alerts*", "@timestamp")
	}
}

func searchEventsHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		searchOpenSearch(c, osClient, "sentinel-events*", "@timestamp")
	}
}
