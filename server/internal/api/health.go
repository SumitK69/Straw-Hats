package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/sentinel-io/sentinel/server/internal/store"
)

// healthHandler returns the server health status.
func healthHandler(osClient *store.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		components := map[string]string{
			"server": "healthy",
		}

		// Check OpenSearch
		if err := osClient.Ping(c.Request.Context()); err != nil {
			components["opensearch"] = "unhealthy: " + err.Error()
		} else {
			components["opensearch"] = "healthy"
		}

		// TODO: Check NATS JetStream connectivity
		components["nats"] = "not_configured"

		// TODO: Check Anomaly Engine connectivity
		components["anomaly_engine"] = "not_configured"

		// Determine overall status
		status := "healthy"
		for _, v := range components {
			if v != "healthy" && v != "not_configured" {
				status = "degraded"
				break
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":     status,
			"version":    "0.1.0-dev",
			"components": components,
		})
	}
}
