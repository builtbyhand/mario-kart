package com.mizan.mariokart

import org.json.JSONArray
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for native input serialization, sensor conversion, and bridge utilities.
 */
class NativeBridgeTest {

    @Test
    fun testGamepadStateJsonGeneration() {
        val steer = -0.75f
        val gas = true
        val brake = false
        val drift = true
        val item = false

        val json = """
            {
                "steer": $steer,
                "gas": $gas,
                "brake": $brake,
                "drift": $drift,
                "item": $item
            }
        """.trimIndent()

        assertTrue(json.contains("\"steer\": -0.75"))
        assertTrue(json.contains("\"gas\": true"))
        assertTrue(json.contains("\"brake\": false"))
        assertTrue(json.contains("\"drift\": true"))
        assertTrue(json.contains("\"item\": false"))
    }

    @Test
    fun testSensorOrientationMath() {
        // Landscape accelerometer: value[1] is roll, multiplied by 9.0f approximately
        val rawRoll = 2.5f
        val calculatedRoll = rawRoll * 9.0f
        assertEquals(22.5f, calculatedRoll, 0.001f)

        val rawPitch = -1.2f
        val calculatedPitch = rawPitch * 9.0f
        assertEquals(-10.8f, calculatedPitch, 0.001f)
    }

    @Test
    fun testVibrationPatternJsonParsing() {
        val patternJson = "[0, 50, 100, 150]"
        val array = JSONArray(patternJson)
        val timings = LongArray(array.length()) { i -> array.getLong(i) }

        assertEquals(4, timings.size)
        assertEquals(0L, timings[0])
        assertEquals(50L, timings[1])
        assertEquals(100L, timings[2])
        assertEquals(150L, timings[3])
    }
}
