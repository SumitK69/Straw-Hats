// Package api provides the REST API handlers.
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
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

// parseTimeRange extracts from/to time range from query params.
// Defaults: from = 3 days ago, to = now.
func parseTimeRange(c *gin.Context) (string, string) {
	now := time.Now().UTC()
	defaultFrom := now.Add(-3 * 24 * time.Hour).Format(time.RFC3339)
	defaultTo := now.Format(time.RFC3339)

	from := c.DefaultQuery("from", defaultFrom)
	to := c.DefaultQuery("to", defaultTo)
	return from, to
}

// searchOpenSearch executes a search query against OpenSearch.
func searchOpenSearch(c *gin.Context, osClient *store.Client, index string, defaultSort string) {
	query := c.Query("q")
	if query == "" {
		query = "*"
	}

	size := c.DefaultQuery("size", "200")

	from, to := parseTimeRange(c)

	// Build query with time range filter
	body := map[string]interface{}{
		"size": size,
		"sort": []map[string]interface{}{
			{defaultSort: map[string]string{"order": "desc"}},
		},
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []map[string]interface{}{
					{
						"query_string": map[string]interface{}{
							"query": query,
						},
					},
				},
				"filter": []map[string]interface{}{
					{
						"range": map[string]interface{}{
							defaultSort: map[string]interface{}{
								"gte": from,
								"lte": to,
							},
						},
					},
				},
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

	// Extract total count from OpenSearch response
	totalCount := len(results)
	if total, ok := hitsMap["total"].(map[string]interface{}); ok {
		if val, ok := total["value"].(float64); ok {
			totalCount = int(val)
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": results, "total": totalCount})
}

// histogramHandler returns date histogram aggregation for timeline charts.
func histogramHandler(osClient *store.Client, index string, timeField string) gin.HandlerFunc {
	return func(c *gin.Context) {
		from, to := parseTimeRange(c)
		interval := c.DefaultQuery("interval", "1h")

		body := map[string]interface{}{
			"size": 0,
			"query": map[string]interface{}{
				"range": map[string]interface{}{
					timeField: map[string]interface{}{
						"gte": from,
						"lte": to,
					},
				},
			},
			"aggs": map[string]interface{}{
				"timeline": map[string]interface{}{
					"date_histogram": map[string]interface{}{
						"field":          timeField,
						"fixed_interval": interval,
						"min_doc_count":  0,
						"extended_bounds": map[string]interface{}{
							"min": from,
							"max": to,
						},
					},
				},
			},
		}

		reqBody, _ := json.Marshal(body)
		osResp, err := osClient.Search(c.Request.Context(), index, reqBody)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Histogram query failed: " + err.Error()})
			return
		}

		// Extract buckets from aggregation response
		buckets := []map[string]interface{}{}
		if aggs, ok := osResp["aggregations"].(map[string]interface{}); ok {
			if timeline, ok := aggs["timeline"].(map[string]interface{}); ok {
				if rawBuckets, ok := timeline["buckets"].([]interface{}); ok {
					for _, b := range rawBuckets {
						if bucket, ok := b.(map[string]interface{}); ok {
							buckets = append(buckets, map[string]interface{}{
								"time":  bucket["key_as_string"],
								"count": bucket["doc_count"],
							})
						}
					}
				}
			}
		}

		// Also extract total hit count
		totalCount := 0
		if hitsMap, ok := osResp["hits"].(map[string]interface{}); ok {
			if total, ok := hitsMap["total"].(map[string]interface{}); ok {
				if val, ok := total["value"].(float64); ok {
					totalCount = int(val)
				}
			}
		}

		c.JSON(http.StatusOK, gin.H{"buckets": buckets, "total": totalCount})
	}
}

// overviewStatsHandler returns summary counts for the dashboard overview.
func overviewStatsHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		// Count agents
		agentCount := countDocs(ctx, osClient, "sentinel-agents*")

		// Count events in last 24h
		now := time.Now().UTC()
		last24h := now.Add(-24 * time.Hour).Format(time.RFC3339)
		last1h := now.Add(-1 * time.Hour).Format(time.RFC3339)
		nowStr := now.Format(time.RFC3339)

		eventCount24h := countDocsInRange(ctx, osClient, "sentinel-events*", "@timestamp", last24h, nowStr)
		eventCount1h := countDocsInRange(ctx, osClient, "sentinel-events*", "@timestamp", last1h, nowStr)

		// Count alerts
		alertCountTotal := countDocs(ctx, osClient, "sentinel-alerts*")
		alertCountOpen := countDocsWithQuery(ctx, osClient, "sentinel-alerts*", map[string]interface{}{
			"query": map[string]interface{}{
				"term": map[string]interface{}{"status": "open"},
			},
		})
		alertCountCritical := countDocsWithQuery(ctx, osClient, "sentinel-alerts*", map[string]interface{}{
			"query": map[string]interface{}{
				"term": map[string]interface{}{"severity": "critical"},
			},
		})

		// Events per second (approximate over last hour)
		var eventsPerSec float64
		if eventCount1h > 0 {
			eventsPerSec = float64(eventCount1h) / 3600.0
		}

		c.JSON(http.StatusOK, gin.H{
			"agents":           agentCount,
			"events_24h":       eventCount24h,
			"events_per_sec":   fmt.Sprintf("%.1f", eventsPerSec),
			"alerts_total":     alertCountTotal,
			"alerts_open":      alertCountOpen,
			"alerts_critical":  alertCountCritical,
		})
	}
}

// countDocs returns the total document count for an index.
func countDocs(ctx context.Context, osClient *store.Client, index string) int {
	body := map[string]interface{}{"query": map[string]interface{}{"match_all": map[string]interface{}{}}}
	return countDocsWithQuery(ctx, osClient, index, body)
}

// countDocsInRange returns count of documents in a time range.
func countDocsInRange(ctx context.Context, osClient *store.Client, index, timeField, from, to string) int {
	body := map[string]interface{}{
		"query": map[string]interface{}{
			"range": map[string]interface{}{
				timeField: map[string]interface{}{"gte": from, "lte": to},
			},
		},
	}
	return countDocsWithQuery(ctx, osClient, index, body)
}

// countDocsWithQuery runs an OpenSearch query and extracts total hit count.
func countDocsWithQuery(ctx context.Context, osClient *store.Client, index string, query map[string]interface{}) int {
	query["size"] = 0
	reqBody, _ := json.Marshal(query)
	resp, err := osClient.Search(ctx, index, reqBody)
	if err != nil {
		return 0
	}
	if hitsMap, ok := resp["hits"].(map[string]interface{}); ok {
		if total, ok := hitsMap["total"].(map[string]interface{}); ok {
			if val, ok := total["value"].(float64); ok {
				return int(val)
			}
		}
	}
	return 0
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
		// Allow custom size for events
		if c.Query("size") == "" {
			c.Request.URL.RawQuery += "&size=" + strconv.Itoa(500)
		}
		searchOpenSearch(c, osClient, "sentinel-events*", "@timestamp")
	}
}
