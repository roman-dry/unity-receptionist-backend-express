const express = require('express');
const axios = require('axios');
require('dotenv').config();


const app = express();
app.use(express.json());

// HubSpot API key (заміни на свій)
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_BASE_URL = 'https://api.hubapi.com';

// Головний endpoint: одна кастомна дія
app.post('/process-inquiry', async (req, res) => {
  const { full_name, phone, email, reason, message } = req.body;
  console.log(full_name);
  console.log(phone);
  console.log(email);
  console.log(reason);
  console.log(message);

  try {
    // КРОК 1: Шукаємо контакт за email
    const searchResponse = await axios.post(
      `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts/search`,
      {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'EQ',
                value: email
              }
            ]
          }
        ],
        properties: ['email', 'firstname', 'lastname']
      },
      {
        headers: {
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    let contactId;

    if (searchResponse.data.total > 0) {
      // Контакт існує
      contactId = searchResponse.data.results[0].id;
    } else {
      // Контакт не існує → створюємо нового
      const createContactResponse = await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/contacts`,
        {
          properties: {
            firstname: full_name,
            phone: phone,
            email: email
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      contactId = createContactResponse.data.id;
    }

    // КРОК 2: Створюємо нотатку або угоду
    if (reason.toLowerCase().includes('partnership') ||
        reason.toLowerCase().includes('vendor') ||
        reason.toLowerCase().includes('bpo') ||
        reason.toLowerCase().includes('product') ||
        reason.toLowerCase().includes('service')) {
      // Дзвінок по продажах — створюємо Deal
      await axios.post(
        `${HUBSPOT_BASE_URL}/crm/v3/objects/deals`,
        {
          properties: {
            dealname: `New ${reason} Inquiry`,
            description: message,
            dealstage: 'appointmentscheduled', // або твій потрібний stage
            pipeline: 'default'
          },
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 3 // Contact to Deal
                }
              ]
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } else {
      // Дзвінок не по продажах — створюємо нотатку
      await axios.post(
        `${HUBSPOT_BASE_URL}/engagements/v1/engagements`,
        {
          engagement: {
            active: true,
            type: 'NOTE'
          },
          associations: {
            contactIds: [contactId]
          },
          metadata: {
            body: message
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }

    return res.status(200).json({ message: 'Processed successfully', contactId });

  } catch (error) {
    console.error(error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(3000, () => {
  console.log('Backend listening on port 3000');
});
